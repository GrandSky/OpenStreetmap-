const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const request = require('request');
const cors = require('cors');
const app = express();
const port = 3000;
const mapnik = require('mapnik');
const axios = require('axios');
//const fs = require('fs').promises;
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const Openrouteservice = require("openrouteservice-js");
const users=[];
const sessions=[];
app.use(bodyParser.json());
//NEW STUFF milestone 2

function generateVerificationKey() {
  // Generate a random string for the verification key
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const keyLength = 20;
  let verificationKey = '';
  for (let i = 0; i < keyLength; i++) {
    verificationKey += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return verificationKey;
}

app.post('/api/adduser', (req, res) => {
  const { username, password, email } = req.body;
  console.log("adduser:\n" + req.body)
  // Check if user already exists
  const existingUser = users.find(user => user.username === username || user.email === email);
  if (existingUser) {
    console.log('\nUSER EXISTS\n')
    return res.status(200).json({status: 'error', error: 'Username or email already exists' });
  }
const verificationKey = generateVerificationKey();

  // Add new user to the users array
  users.push({ username, password, email, verified: false, verificationKey });

  // Send verification email
  sendVerificationEmail(email, verificationKey);
  console.log('\nADDUSER success!\n')
  return res.json({ status: 'ok' });
});

// Endpoint to log in
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log('\nAttempting to LOGIN\n')
  // Find user by username
  const user = users.find(user => user.username === username);
  if (!user || user.password !== password) {
    console.log("\nLOGIN FAILURE!!!\n")
    return res.status(200).json({status: 'error', error: 'Invalid username or password' });
  }
  //if (!user.verified) {
    //return res.status(200).json({status: 'error', error: 'Account not verified' });
  //}
  // Generate session ID
  const sessionId = generateSessionId();

  // Store session in sessions array
  sessions.push({ sessionId, username });

  // Set session ID cookie
  res.cookie('sessionId', sessionId, { httpOnly: true });
  console.log('\nLOGIN success!\n')
  return res.json({ status: 'ok' });
});

// Endpoint to log out
app.post('/api/logout', (req, res) => {
  const { sessionId } = req.cookies;
  console.log('\nTRYING TO logout:\n')
  // Remove session from sessions array
  const sessionIndex = sessions.findIndex(session => session.sessionId === sessionId);
  if (sessionIndex !== -1) {
    sessions.splice(sessionIndex, 1);
  }

  // Clear session ID cookie
  res.clearCookie('sessionId');
  console.log('\nLOGOUT SUCCESS\n')
  return res.json({ status: 'ok' });
});

// Endpoint to check if a user is logged in
app.get('/api/user', (req, res) => {
  const { sessionId } = req.cookies;
console.log("\nCHECKING FOR USER IS LOGGED IN\n")
  // Find session by session ID
  const session = sessions.find(session => session.sessionId === sessionId);

  if (session) {
  console.log('\nUSER IS LOGGED IN\n')
    return res.json({ loggedin: true, username: session.username });
  } else {
  console.log('\nUSER IS NOT LOGGED IN\n')
    return res.json({ loggedin: false, username: null });
  }
});
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15);
}

// Endpoint to handle email verification
app.get('/api/verify', async (req, res) => {
  const { email, key } = req.query;
 console.log("\nVERIFYING!\n")
  try {
    // Verify email and key against your data (users array)
    const user = users.find(user => user.email === email && user.verificationKey === key);
    if (!user) {
      console.log('\nINVALID VERIFY LINK\n')
      return res.status(200).json({ status: 'error',error: 'Invalid verification link' });
    }

    // Update user's verification status
    user.verified = true;
    console.log("\nVERIFY SUCCESS\n")
    // Send response
    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error verifying email:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// Endpoint to handle route calculations
app.post('/api/route', async (req, res) => {
  const { source, destination } = req.body;
  console.log("request got: ", req.body);
  try {
/*
  let orsDirections = new Openrouteservice.Directions({ api_key: "5b3ce3597851110001cf624833039f9a32c04c58abcb8136bb84159e"});
        let response = await orsDirections.calculate({
                //the library wants it in lon, lat and returns lon, lat
                //distance is in meters and time is in seconds
                coordinates: [[source.lon , source.lat] , [destination.lon, destination.lat]],
                profile: 'driving-hgv',
                format: 'geojson'
        })
*/
////////////////////////////////////////////////////////////////////////////// OLD CODE
/*
        // change ip when needed
        const routeServerUrl = "http://209.151.150.166:8080/ors/v2/directions/driving-car/geojson"
        // Prepare the route request payload
        const payload = {
                "coordinates": [[source.lon , source.lat] , [destination.lon, destination.lat]],
                "profile": 'driving-car',
//              "format": 'geojson',
                "preference":"fastest"
        };
        console.log("Starting post request with payload:")
        console.log(payload)

        // Send the POST request to the route server
        axios.post(routeServerUrl, payload, {headers: {'Content-Type': 'application/json'}})
                .then(response => {
                // Handle successful response
                        console.log("Route response:", response.data);
                        //console.log("response: ", response)
                // Extract features and segments from the response
                const features = response.data.features;
                const properties = features[0].properties;
                const segments = properties.segments;

                // Construct the route response array
                const routeResponse = segments[0].steps.map(step => ({
                description: step.instruction,
                coordinates: {
                        lat: features[0].geometry.coordinates[step.way_points[0]][1],
                        lon: features[0].geometry.coordinates[step.way_points[0]][0]
                },
                distance: step.distance
                }));
                console.log("response sent: ", routeResponse);
                // Send the route response as JSON
                return res.json(routeResponse);
                // return res.json({ status: 'ok' });

                // Process the route data
                })
                .catch(error => {
                // Handle error
                        //cheese
                        return res.status(200).json([{description: 'Empty', coordinates: { lat: 0, lon: 0}, distance: 0}]);
                        console.error("Error:", error.message);
        });
*/
///////////////////////////////////////////////////////////////////////////////////////NEW CODE
const apiUrl = `http://router.project-osrm.org/route/v1/driving/${source.lon},${source.lat};${destination.lon},${destination.lat}?steps=true`;

// Fetch the data
fetch(apiUrl)
  .then(response => response.json())
  .then(jsonResponse => {
    // Extract route steps
    const routeSteps = jsonResponse.routes[0].legs[0].steps;

    // Convert each step to the specified format
    const convertedSteps = routeSteps.map(step => ({
      description: step.name,
      coordinates: {
        lat: step.maneuver.location[1],
        lon: step.maneuver.location[0]
      },
      distance: step.distance
    }));

    // Print the converted steps
    console.log(convertedSteps);
    return res.json(convertedSteps);
  })
  .catch(error => console.error('Error fetching data:', error));
/*
        //console.log("response: ", response)
        // Extract features and segments from the response
        const features = response.features;
        const properties = features[0].properties;
        const segments = properties.segments;

        // Construct the route response array
        const routeResponse = segments[0].steps.map(step => ({
            description: step.instruction,
            coordinates: {
                lat: features[0].geometry.coordinates[step.way_points[0]][1],
                lon: features[0].geometry.coordinates[step.way_points[0]][0]
            },
            distance: step.distance
        }));
        console.log("response sent: ", routeResponse);
        // Send the route response as JSON
        return res.json(routeResponse);
       // return res.json({ status: 'ok' });
*/
} catch (err){
        console.log("An error occurred: " + err.status)
        console.error(await err.response.json())
  }
});

app.post('/api/address', (req, res) => {
  // Extract latitude and longitude from request body
  const { lat, lon } = req.body;
console.log(lat,lon)
  const apiUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

  // Make the HTTP request to the geocoding API
/*  fetch(apiUrl)
    .then(response => {
      // Check if the response is successful
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      // Parse the JSON response
      return response.json();
    })
    .then(data => {
      // Extract address components from the response
      const { address } = data;
console.log(address)
      const { house_number, road,town, hamlet,village, city, state, country } = address;
      const cityName = city || town ||village|| hamlet || '';
      // Construct the address object in the desired format
      const formattedAddress = {
        number: house_number || '',
        street: road || '',
        city: cityName || '',
        state: state || '',
        country: country || ''
      };

      // Send the formatted address as the response
      console.log("ADDRESS")
      console.log(formattedAddress)
      res.json(formattedAddress);
    })
    .catch(error => {
      // Handle any errors that occurred during the fetch
      console.error('Error:', error);
      // Send an error response
      res.status(500).json({ error: 'Failed to retrieve address' });
    });*/
});

// Function to send verification email
function sendVerificationEmail(email, key) {
    // Create a transporter object using SMTP transport
    const caCert = fs.readFileSync('/etc/ssl/certs/ssl-cert-snakeoil.pem');

    const transporter = nodemailer.createTransport({
        host: 'grandsky.cse356.compas.cs.stonybrook.edu', // Replace with your Postfix server hostname
        port: 25, // or your SMTP port if different
        secure: false, // true for 465, false for other ports
        tls: {
            rejectUnauthorized: false, // Don't verify the certificate
            ca: [caCert] // Pass the self-signed certificate
        }
    });
const verifyLink = `http://grandsky.cse356.compas.cs.stonybrook.edu/api/verify?email=${email}&key=${key}`;

    // Compose the email
    const mailOptions = {
        from: 'verify@cse356.compas.cs.stonybrook.edu',
        to: email,
        subject: 'Account Verification',
        html: `
            <p>Click the following link to verify your email address:</p>
            <p><a href="${verifyLink}">Verify Email</a></p>
        `
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(error);
        } else {
            console.log('Email sent: ' + info.response + ' ' + email);
        }
    });
}


// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
