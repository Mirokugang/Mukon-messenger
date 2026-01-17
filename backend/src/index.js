const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PublicKey } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// In-memory storage (replace with Redis/DB in production)
const messages = new Map(); // conversationId -> Message[]
const onlineUsers = new Map(); // pubkey -> socket.id

// Verify wallet signature
function verifySignature(publicKey, message, signature) {
  try {
    const pubkey = new PublicKey(publicKey);
    const messageBytes = Buffer.from(message, 'utf8');
    const signatureBytes = bs58.decode(signature);

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubkey.toBytes()
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

// Generate conversation ID from two pubkeys (sorted)
function getConversationId(pubkey1, pubkey2) {
  const sorted = [pubkey1, pubkey2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

// REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/messages', async (req, res) => {
  try {
    const { conversationId, encrypted, nonce, sender, signature } = req.body;

    // Verify signature
    const message = `Send message to ${conversationId}`;
    if (!verifySignature(sender, message, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Store message
    if (!messages.has(conversationId)) {
      messages.set(conversationId, []);
    }

    const messageData = {
      id: Date.now().toString(),
      sender,
      encrypted,
      nonce,
      timestamp: Date.now()
    };

    messages.get(conversationId).push(messageData);

    // Broadcast to conversation participants
    io.to(conversationId).emit('new_message', messageData);

    res.json({ success: true, messageId: messageData.id });
  } catch (error) {
    console.error('Error posting message:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/messages/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const { sender, signature } = req.query;

  // Verify signature
  const message = `Get messages from ${conversationId}`;
  if (!verifySignature(sender, message, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const conversationMessages = messages.get(conversationId) || [];
  res.json({ messages: conversationMessages });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('authenticate', ({ publicKey, signature }) => {
    // Verify signature
    const message = `Authenticate ${socket.id}`;
    if (verifySignature(publicKey, message, signature)) {
      onlineUsers.set(publicKey, socket.id);
      socket.publicKey = publicKey;
      socket.emit('authenticated', { success: true });
      console.log('User authenticated:', publicKey);
    } else {
      socket.emit('authenticated', { success: false, error: 'Invalid signature' });
    }
  });

  socket.on('join_conversation', ({ conversationId }) => {
    socket.join(conversationId);
    console.log(`${socket.publicKey} joined conversation: ${conversationId}`);
  });

  socket.on('leave_conversation', ({ conversationId }) => {
    socket.leave(conversationId);
    console.log(`${socket.publicKey} left conversation: ${conversationId}`);
  });

  socket.on('send_message', ({ conversationId, encrypted, nonce }) => {
    if (!socket.publicKey) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const messageData = {
      id: Date.now().toString(),
      sender: socket.publicKey,
      encrypted,
      nonce,
      timestamp: Date.now()
    };

    // Store message
    if (!messages.has(conversationId)) {
      messages.set(conversationId, []);
    }
    messages.get(conversationId).push(messageData);

    // Broadcast to conversation
    io.to(conversationId).emit('new_message', messageData);
  });

  socket.on('typing', ({ conversationId }) => {
    socket.to(conversationId).emit('user_typing', {
      publicKey: socket.publicKey
    });
  });

  socket.on('disconnect', () => {
    if (socket.publicKey) {
      onlineUsers.delete(socket.publicKey);
      console.log('User disconnected:', socket.publicKey);
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Mukon Messenger backend running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`HTTP endpoint: http://localhost:${PORT}`);
});
