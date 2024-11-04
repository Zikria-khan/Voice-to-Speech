import React, { useState } from 'react';
import axios from 'axios';
import './Register.css';
import { Link, useNavigate } from 'react-router-dom';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [image, setImage] = useState(null); // State for the image
    const navigate = useNavigate();

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'recordersimages'); // Replace with your Cloudinary upload preset

            try {
                const response = await axios.post(`https://api.cloudinary.com/v1_1/dtuhnl2sa/image/upload`, formData); // Replace with your Cloudinary cloud name
                setImage(response.data.secure_url); // Get the uploaded image URL
            } catch (error) {
                console.error("Error uploading image:", error);
                alert("Image upload failed. Please try again.");
            }
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
    
        // Log data before sending
        console.log("Submitting registration with:", { name, email, password, image });
    
        // Validate image upload
        if (!image) {
            alert("Image upload is required before registration.");
            return;
        }
    
        try {
            // Clear local storage before registration
            localStorage.clear();
    
            // Send registration request
            const response = await axios.post('https://voice-to-speech-six.vercel.app/register', { name, email, password, image });
     console.log(response)
            // Store the user object in local storage
            localStorage.setItem('user', JSON.stringify({
                name,
                email,
                image: response.data.user.image ,// Save the image URL received from the server
                 id : response.data.user.id
            }));
      localStorage.setItem('token', JSON.stringify(
      response.data.token

      ));
            alert("User registered successfully!");
    
            // Redirect to the AudioRecorder route after successful registration
            navigate('/AudioRecorder');
    
        } catch (error) {
            console.error("Error registering user:", error.response ? error.response.data : error.message);
            alert("Registration failed. Please try again.");
        }
    };
    

    return (
        <div className="auth-container">
            <h2>Register</h2>
            <form onSubmit={handleSubmit}>
                <input 
                    type="text" 
                    placeholder="Name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                />
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
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    required 
                />
                <button type="submit">Register</button>
            </form>
            <p>Already have an account? <Link to="/">Login here</Link></p>
        </div>
    );
};

export default Register;
