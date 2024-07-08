import express from 'express';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Message from './models/Message.js';  // Ensure this path is correct

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chatapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Error connecting to MongoDB:', err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3500;
const ADMIN = 'Admin';

const app = express();

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve the index.ejs file
app.get('/', (req, res) => {
    res.render('index');
});

const expressServer = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5500', 'http://127.0.0.1:5500']
    }
});

const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray;
    }
};

io.on('connection', (socket) => {
    console.log(`User ${socket.id} connected`);

    socket.emit('message', buildMsg(ADMIN, 'Welcome to Chat App!'));

    socket.on('enterRoom', async ({ name, room }) => {
        const prevRoom = getUser(socket.id)?.room;

        if (prevRoom) {
            socket.leave(prevRoom);
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} has left the room`));
        }

        const user = activateUser(socket.id, name, room);

        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)
            });
        }

        socket.join(user.room);

        // Load previous messages from the database
        const messages = await Message.find({ room: user.room }).sort('timestamp');
        socket.emit('loadMessages', messages);

        socket.emit('message', buildMsg(ADMIN, `You have joined the ${user.room} chat room`));
        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined the room`));

        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        });

        io.emit('roomList', {
            rooms: getAllActiveRooms()
        });
    });

    socket.on('disconnect', () => {
        const user = getUser(socket.id);
        userLeavesApp(socket.id);

        if (user) {
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`));

            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            });

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            });
        }

        console.log(`User ${socket.id} disconnected`);
    });

    socket.on('message', async ({ name, text }) => {
        const room = getUser(socket.id)?.room;
        if (room) {
            const message = new Message({ user: name, text, room });
            try {
                await message.save();
                console.log('Message saved to the database');
                io.to(room).emit('message', buildMsg(name, text));
            } catch (err) {
                console.error('Error saving message to database:', err);
            }
        }
    });

    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room;
        if (room) {
            socket.broadcast.to(room).emit('activity', name);
        }
    });
});

function buildMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date())
    };
}

function activateUser(id, name, room) {
    const user = { id, name, room };
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ]);
    return user;
}

function userLeavesApp(id) {
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    );
}

function getUser(id) {
    return UsersState.users.find(user => user.id === id);
}

function getUsersInRoom(room) {
    return UsersState.users.filter(user => user.room === room);
}

function getAllActiveRooms() {
    return Array.from(new Set(UsersState.users.map(user => user.room)));
}
