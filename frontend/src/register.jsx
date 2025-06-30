import React, { useState } from "react";
import { userNavigate } from "react-router-dom";
import axios from "axios"

function Register() {
    function SwitchContent(){
        const content = document.getElementById('content');
        const registerBtn = document.getElementById('register');
        const loginBtn = document.getElementById('login');

        registerBtn.addEventListener('click', () =>{
            content.classList.add("active")
        });
        loginBtn.addEventListener('click', ()=> {
            content.classList.remove("active");
        });
    }
    const [username,setUsername] = useState([])
    const [email,setEmail] = useState([])
    const [password,setPassword] = useState([])
    const navigate = userNavigate()

    function register(event){
        event.preventDefault()
        axios.post("http://localhost:8001/register", {username, email, passowrd})
        .then(res=>{
            navigate("/home")
        }).catch(err=>console.log(err))
    }
    return (
        <div id="content" className="form-container">
            <h2>Register</h2>
            <form onSubmit={register}>
                <div>
                    <label>Username:</label>
                    <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        required 
                    />
                </div>
                <div>
                    <label>Email:</label>
                    <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                    />
                </div>
                <div>
                    <label>Password:</label>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                    />
                </div>
                <button type="submit">Register</button>
            </form>

            {/* Optional buttons for switching content */}
            <div>
                <button id="login">Login</button>
                <button id="register">Register</button>
            </div>
        </div>
    );
}

export default Register;
