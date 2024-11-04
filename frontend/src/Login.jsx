import React, { useState } from 'react';
import axios from 'axios';
import './Login.css'; // Import the CSS file
import { useNavigate } from 'react-router-dom'; // Import useNavigate for redirection

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate(); // Initialize useNavigate hook for navigation

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('https://voice-to-speech-six.vercel.app/login', { email, password });
            const token = response.data.token; // Retrieve the token from the response
            const user = response.data.user; // Retrieve user data from the response

            localStorage.setItem('token', token); // Store the token in localStorage
            localStorage.setItem('user', JSON.stringify(user)); // Store user data as a JSON string

            alert("Login successful!"); // Optional success message
            
            // Redirect to the AudioRecorder route after login
            navigate('/AudioRecorder'); // Change this path to /AudioRecorder

        } catch (error) {
            console.error("Error logging in:", error.response ? error.response.data : error.message);
            alert("Login failed. Please check your credentials.");
        }
    };

    return (
        <div className="auth-container">
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <input 
                    type="email" 
                    placeholder="Email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                />
                <input 
                    type="password" 
                    placeholder="Password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                />
                <button type="submit">Login</button>
            </form>
            <p>Don't have an account? <a href="/register">Register here</a></p> {/* Link to Register page */}
        </div>
    );
};

export default Login;
