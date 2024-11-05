require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const connectDB = require('./db/connection');
const Transcription = require('./models/textSchema');
const User = require('./models/userSchema');

const app = express();
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const corsOptions = {
    origin: 'https://voice-to-speech-7q3p.vercel.app', // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify the allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Specify the allowed headers
};
app.use(cors(corsOptions));

// Middleware for token authentication
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(401);
        req.user = user;
        next();
    });
};

// Test API root endpoint
app.get('/', (req, res) => {
    res.status(200).json({ message: 'API is running and ready for testing!' });
});

// User registration endpoint
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, image } = req.body;
        if (!name || !email || !password || !image) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, image });
        await newUser.save();

        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, image: newUser.image } });
    } catch (error) {
        console.error("Error registering user:", error.message);
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
});

// User login endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, image: user.image } });
    } catch (error) {
        console.error("Error logging in user:", error.message);
        res.status(500).json({ message: 'Error logging in user', error: error.message });
    }
});

// Configure multer for file storage in /tmp
const upload = multer({ 
    dest: path.join('/tmp'), // Use the /tmp directory
    limits: { fileSize: 100 * 1024 * 1024 } // Set limits (e.g., 10 MB)
});

// Function to poll AssemblyAI transcription status
async function pollTranscriptionStatus(transcriptionId) {
    const pollingInterval = 5000;

    return new Promise((resolve, reject) => {
        const checkStatus = async () => {
            try {
                const response = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptionId}`, {
                    headers: { 'authorization': process.env.ASSEMBLYAI_API_KEY },
                });
                console.log(`Transcription ID ${transcriptionId} status:`, response.data.status); // Log transcription status
                
                if (response.data.status === 'completed') {
                    resolve(response.data.text);
                } else if (response.data.status === 'failed') {
                    reject('Transcription failed.');
                } else {
                    setTimeout(checkStatus, pollingInterval);
                }
            } catch (error) {
                reject(error);
            }
        };
        checkStatus();
    });
}

// Audio upload and transcription endpoint
app.post('/upload', upload.single('audio'), async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded." });
        }

        const audioFilePath = req.file.path; // Now pointing to /tmp
        const allowedMimeTypes = ['audio/mpeg', 'audio/wav'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            fs.unlinkSync(audioFilePath);
            return res.status(400).json({ message: "Unsupported file type." });
        }

        const audioBuffer = fs.readFileSync(audioFilePath);
        if (audioBuffer.length === 0) {
            fs.unlinkSync(audioFilePath);
            return res.status(400).json({ message: "Audio file is empty." });
        }

        const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', audioBuffer, {
            headers: {
                'authorization': process.env.ASSEMBLYAI_API_KEY,
                'content-type': 'application/octet-stream',
                'Content-Length': audioBuffer.length.toString(),
            },
        });

        const audioUrl = uploadResponse.data.upload_url;
        const transcriptionResponse = await axios.post('https://api.assemblyai.com/v2/transcript', { audio_url: audioUrl }, {
            headers: { 'authorization': process.env.ASSEMBLYAI_API_KEY },
        });

        const transcriptionId = transcriptionResponse.data.id;
        const transcriptionText = await pollTranscriptionStatus(transcriptionId);

        // Log the transcription text to debug
        console.log("Transcription Text:", transcriptionText);

        if (!transcriptionText || transcriptionText.trim() === '') {
            return res.status(400).json({ message: "Transcription text is empty." });
        }

        // Save transcription details to the database
        const transcriptionData = new Transcription({
            audioURL: audioUrl,
            transcription: transcriptionText,
            status: 'completed',
            userId: userId
        });
        await transcriptionData.save();

        res.status(200).json({ message: "Transcription completed and saved successfully.", transcription: transcriptionText });
    } catch (error) {
        console.error("Error processing audio:", error.message || error.response.data);
        res.status(500).json({ message: "Error processing audio" });
    } finally {
        if (req.file) fs.unlinkSync(req.file.path); // Clean up the uploaded file
    }
});

// Get all transcriptions for a user
app.post('/getall/:id', async (req, res) => {
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ message: "User ID is required." });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found." });

        const transcriptions = await Transcription.find({ userId: user._id });
        res.json({ user, transcriptions });
    } catch (error) {
        console.error("Error fetching user data:", error.message);
        res.status(500).json({ message: "Internal server error." });
    }
});

// DELETE endpoint to delete a transcription by ID
app.delete('/delete/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).send({ message: "Transcription ID is required" });
    }

    try {
        const transcription = await Transcription.findByIdAndDelete(id);
        if (!transcription) {
            return res.status(404).send({ message: "Transcription not found" });
        }
        res.send({ message: "Transcription deleted successfully" });
    } catch (error) {
        res.status(500).send({ message: "Error deleting transcription", error });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
