import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import pg from "pg";
import multer from "multer"; // Import multer for handling file uploads
import nodemailer from "nodemailer";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;
let usersId='';

app.use(express.static(__dirname + '/public'));

// PostgreSQL client setup
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "blog",
    password: "Habtshi",  // Update this to the new password
    port: 5432,
});

db.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Connection error', err.stack));



let blogs = [];

app.listen(port, () => {
    console.log("listening on port 3000");
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.get("/create", (req, res) => {
    res.sendFile(__dirname + "/public/Emailverfication.html");
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); 



// Multer setup to handle file uploads
const upload = multer();

// Nodemailer setup for sending emails
const transporter = nodemailer.createTransport({
    service: 'gmail', // Replace this with your email service provider
    auth: {
        user: 'thabtamu417@gmail.com',  // Your email
        pass: 'fokl mwse hoea cplb'     // Your email password or an app-specific password if using Gmail
    }
});
app.post("/About", async (req, res) => {
    const { firstname, lastname, department,faculty,interested_about } = req.body;
    const email = `${firstname.trim().toLowerCase()}.${lastname.trim().toLowerCase()}@my.smsu.edu`;

    try {
        // Check if a user with this email exists
        const result = await db.query("SELECT username FROM accounts WHERE username = $1", [email]);

        if (result.rows.length > 0) {
            // If a matching user is found, update their record with firstname, lastname, department, and interested_about
            await db.query(
                "UPDATE accounts SET firstname = $1, lastname = $2, department = $3, faculty=$4 , interested_about = $5 WHERE username = $6",
                [firstname.trim(), lastname.trim(), department, faculty, interested_about, email]
            );
            // Send the homepage
            res.sendFile(__dirname + "/public/homepage.html");
        } else {
            // If no matching user is found, send the index page
            res.sendFile(__dirname + "/public/index.html");
        }
    } catch (err) {
        console.error("Error executing query", err.stack);
        res.status(500).send("Server error");
    }
});



// Temporarily store user data until verification
let pendingVerification = {};

app.post("/created", (req, res) => {
    // Extract the form data from the request body
    const { email, password } = req.body;

    if (!email.endsWith("@my.smsu.edu")) {
        return res.status(400).send("Only @my.smsu.edu emails are allowed.");
    }

    // Generate a random 6-digit verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString();

    // Temporarily store the user data with the generated verification code
    pendingVerification[email] = { password, verificationCode };

    // Send the verification code via email
    const mailOptions = {
        from: 'thabtamu417@gmail.com',  // Replace with your email
        to: email,                     // The user's email
        subject: 'Your Verification Code',
        text: `Your verification code is ${verificationCode}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Error sending email:", error.stack);
            return res.status(500).send("Error sending verification code.");
        } else {
            console.log("Verification code sent:", info.response);
            // Redirect to the verification page after sending the email
            res.sendFile(__dirname + "/public/verify.html");
        }
    });
});


app.post("/verify-code", (req, res) => {
    const { username, verificationCode } = req.body;

    if (pendingVerification[username].verificationCode === verificationCode.toString()) {
        const { firstname, lastname, password } = pendingVerification[username];

        db.query(
            "INSERT INTO accounts(firstname, lastname, username, passwords) VALUES($1, $2, $3, $4)",
            [firstname, lastname, username, password],
            (err, result) => {
                if (err) {
                    console.error("Error creating account:", err.stack);
                    res.status(500).send("Error creating account.");
                } else {
                    delete pendingVerification[username];
                    res.status(200).send("Verification successful");
                }
            }
        );
    } else {
        res.status(400).send("Invalid verification code.");
    }
});




app.get("/new", (req, res) => {
    res.sendFile(__dirname + "/public/new.html");
});

app.post("/login", (req, res) => {
    db.query("SELECT username, passwords, id FROM accounts", (err, results) => {
        if (err) {
            console.error("Error executing query", err.stack);
            res.status(500).send("Internal Server Error");
        } else {
            // Find the matching user
            const matchingUser = results.rows.find(
                userObj => userObj.username === req.body.username && userObj.passwords === req.body.password
            );

            if (matchingUser) {
                // Save the user ID for later use
                usersId = matchingUser.id;

                // Log or handle the user ID as needed
                console.log("Logged-in User ID:", usersId);

                // Redirect to homepage
                res.sendFile(__dirname + "/public/homepage.html");
            } else {
                // Redirect back to login page on failure
                res.sendFile(__dirname + "/public/index.html");
            }
        }
    });
});


// Handling image uploads and blog saving
app.post("/save", upload.array('images'), (req, res) => {
    const { name, blog } = req.body;
    console.log(req.body)
    const images = req.files.map(file => file.buffer); // Convert uploaded files to Buffers (binary data)
    console.log(images);
    db.query(
        "INSERT INTO blogs (id,blog_topic, blog, images) VALUES ($1, $2, $3, $4)",
        [usersId,name, blog, images],
        (err, result) => {
            if (err) {
                console.error("Error saving blog:", err.stack);
                res.status(500).send("Error saving blog");
            } else {
                blogs.push(req.body);
                
                res.sendFile(__dirname + "/public/new.html");
            }
        }
    );
});

app.get("/Read", (req, result) => {
    db.query("SELECT * FROM accounts", (err, res) => {
        if (err) {
            console.error("Error executing query", err.stack);
        } else {
            
            result.render("profiles.ejs", {
                files: res.rows
            });
        }
    });
});

app.post('/blog-interaction', async (req, res) => {
    const { pk, like, comments } = req.body;

    if (!pk) {
        return res.status(400).send({ error: 'Blog primary key (pk) is required.' });
    }

    try {
        // Increment the like counter if 'like' is true
        if (like) {
            await db.query(
                'UPDATE blogs SET like_counter = like_counter + 1 WHERE pk = $1',
                [pk]
            );
        }

        // Append new comments to the comments array if provided
        if (comments && comments.length > 0) {
            await db.query(
                'UPDATE blogs SET comments = COALESCE(comments, ARRAY[]::TEXT[]) || $1 WHERE pk = $2',
                [comments, pk]
            );
        }

        res.send({ message: 'Blog interaction updated successfully.' });
    } catch (err) {
        console.error('Error updating blog:', err);
        res.status(500).send({ error: 'An error occurred while updating the blog.' });
    }
});


app.post("/get-blogs", (req, result) => {
    const userId = req.body.userId;
    // Get the userId from the query string
    // Query the database to fetch blogs by the given userId
    db.query("SELECT * FROM blogs WHERE id = $1", [userId], (err, res) => {
        if (err) {
            console.error("Error executing query", err.stack);
            result.status(500).send("Internal Server Error");
        } else {
            
            // Render the read.ejs file with the filtered blogs
            result.render("read.ejs", {
                files: res.rows, // Pass filtered blogs
                userId: userId  // Pass userId for context (optional)
            });
        }
    });
});

app.get("/forgot_password", (req, res) => {
    res.sendFile(__dirname + "/public/Forgotpass.html");
});


// Handling password update
app.post("/update", (req, res) => {
    db.query("SELECT passwords FROM accounts WHERE username = $1", [req.body.username], (err, result) => {
        if (err) {
            console.error("Error executing query", err.stack);
        } else {
            if (result.rows.length > 0) {
                // User exists, now update the password
                db.query(
                    "UPDATE accounts SET passwords = $1 WHERE username = $2",
                    [req.body.new_password, req.body.username],
                    (err, result) => {
                        if (err) {
                            console.error("Error executing UPDATE query", err.stack);
                            res.status(500).send("Server error");
                        } else {
                            console.log("Password updated successfully");
                            res.sendFile(__dirname + "/public/index.html");
                        }
                    }
                );
            } else {
                res.status(404).send("User not found");
            }
        }
    });
});
app.post("/forgot-password-request", (req, res) => {
    const { email } = req.body;

    if (!email.endsWith("@my.smsu.edu")) {
        return res.status(400).send("Only @my.smsu.edu emails are allowed.");
    }

    // Check if user exists
    db.query("SELECT username FROM accounts WHERE username = $1", [email], (err, result) => {
        if (err) {
            console.error("Error executing query", err.stack);
            return res.status(500).send("Server error");
        }

        if (result.rows.length === 0) {
            return res.status(404).send("No user found with this email.");
        }

        // Generate a 6-digit verification code
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        pendingVerification[email] = { verificationCode };

        // Email the verification code
        const mailOptions = {
            from: 'thabtamu417@gmail.com',
            to: email,
            subject: 'Your Password Reset Verification Code',
            text: `Your verification code is ${verificationCode}. Please enter this code to reset your password.`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error.stack);
                return res.status(500).send("Error sending verification code.");
            } else {
                console.log("Verification code sent:", info.response);
                res.status(200).send("Verification code sent to your email.");
            }
        });
    });
});

app.post("/reset-password", (req, res) => {
    const { email, verificationCode, newPassword } = req.body;

    if (!pendingVerification[email] || pendingVerification[email].verificationCode !== verificationCode) {
        return res.status(400).send("Invalid or expired verification code.");
    }

    // Update password in the database
    db.query("UPDATE accounts SET passwords = $1 WHERE username = $2", [newPassword, email], (err, result) => {
        if (err) {
            console.error("Error updating password:", err.stack);
            return res.status(500).send("Error resetting password.");
        }

        // Remove the verification data after successful password reset
        delete pendingVerification[email];
        res.status(200).send("Password reset successful. You can now log in with your new password.");
    });
});


app.get("/backtohomepage", (req, res) => {
    res.sendFile(__dirname + "/public/homepage.html");
});
app.get("/Logout",(req,res)=>{
    usersId='';
    res.sendFile(__dirname + "/public/index.html"); 
});
