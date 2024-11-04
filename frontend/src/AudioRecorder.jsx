import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './AudioRecorder.css';

const SpeechToTextApp = () => {
    const [recording, setRecording] = useState(false);
    const [transcriptions, setTranscriptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const userId = user ? user.id : null;
    const image = user?.image || 'default-profile.png'; // Default image if no user image
    const name = user?.name || 'User';

    useEffect(() => {
        const fetchTranscriptions = async () => {
            if (!userId) return;
            setLoading(true);
            try {
                const response = await axios.post(`https://voice-to-speech-six.vercel.app/getall/${userId}`, {}, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                setTranscriptions(response.data.transcriptions || []);
                toast.success("Transcriptions fetched successfully!");
            } catch (error) {
                console.error('Error fetching transcriptions:', error);
                toast.error("Failed to fetch transcriptions. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        fetchTranscriptions();
    }, [token, userId]);

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            if (audioBlob.size === 0) {
                toast.error('The audio blob is empty. Please check the recording process.');
                return;
            }

            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');
            formData.append('userId', userId);

            try {
                toast.info("Processing your recording...");
                const response = await axios.post('https://voice-to-speech-six.vercel.app/upload', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                })
                
                setTranscriptions(prev => [...prev, response.data]);

                toast.success('Transcription uploaded successfully!');
            } catch (error) {
                console.error('Error uploading audio:', error);
                toast.error('Error uploading audio: ' + (error.response ? error.response.data : error.message));
            }
        };

        mediaRecorderRef.current.start();
        audioChunksRef.current = [];
        setRecording(true);
        toast.info('Recording started...');
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setRecording(false);
            toast.info('Recording stopped.');
        }
    };

    const deleteTranscription = async (id) => {
        if (!id) {
            console.error("No transcription ID provided for deletion.");
            toast.error("No transcription ID provided.");
            return;
        }

        try {
            await axios.delete(`https://voice-to-speech-six.vercel.app/delete/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTranscriptions(transcriptions.filter(item => item._id !== id));
            toast.success('Transcription deleted successfully!');
        } catch (error) {
            console.error("Error deleting transcription:", error.response ? error.response.data : error.message);
            toast.error("Error deleting transcription. Please try again.");
        }
    };

    return (
        <div className="app-container">
            <ToastContainer />
            <header className="app-header">
                <h1>Speech to Text App</h1>
                <div className="user-profile">
                    <img src={image} alt="User Profile" className="profile-image" />
                    <span className="profile-name">{name}</span>
                </div>
            </header>
            <div className="recorder">
                <button className="record-button" onClick={recording ? stopRecording : startRecording}>
                    {recording ? 'Stop Recording' : 'Start Recording'}
                </button>
            </div>
            <div className="transcription-list">
                <h2>All Transcriptions</h2>
                {loading ? (
                    <p>Loading transcriptions...</p>
                ) : (
                    transcriptions.length === 0 ? (
                        <p>No transcriptions available. Start recording to add your first transcription!</p>
                    ) : (
                        <ul className='container-transcript'>
                            {transcriptions.map((item) => (
                              <li key={item._id} className="transcription-item">
                              <p><strong>Transcription:</strong> {item.transcription}</p>
                              <button className="delete-button" onClick={() => deleteTranscription(item._id)}>✕</button>
                          </li>
                          
                            ))}
                        </ul>
                    )
                )}
            </div>
            <footer className="app-footer">
                <p>This is a product of Zakriya Khan Ltd</p>
            </footer>
        </div>
    );
};

export default SpeechToTextApp;
