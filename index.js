import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import pg from "pg";
import multer from "multer"; // Import multer for handling file uploads

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

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
    res.sendFile(__dirname + "/public/creataccount.html");
});

app.use(bodyParser.urlencoded({ extended: true }));

// Multer setup to handle file uploads
const upload = multer();

// Handling account creation
app.post("/created", (req, res) => {
    console.log(req.body);
    db.query(
        "INSERT INTO accounts(firstname, lastname, username, passwords) VALUES($1, $2, $3, $4)",
        [req.body.firstname, req.body.lastname, req.body.username, req.body.password],
        (err, result) => {
            if (err) {
                console.error("Error creating account:", err.stack);
                res.status(500).send("Error creating account");
            } else {
                res.sendFile(__dirname + "/public/index.html");
            }
        }
    );
});

app.get("/new", (req, res) => {
    res.sendFile(__dirname + "/public/new.html");
});

// Handling login
app.post("/login", (req, res) => {
    db.query("SELECT username, passwords FROM accounts", (err, results) => {
        if (err) {
            console.error("Error executing query", err.stack);
        } else {
            const credentialsMatch = results.rows.some(
                userObj => userObj.username === req.body.username && userObj.passwords === req.body.password
            );

            if (credentialsMatch) {
                res.sendFile(__dirname + "/public/homepage.html");
            } else {
                res.sendFile(__dirname + "/public/index.html");
            }
        }
    });
    console.log(req.body);
});

// Handling image uploads and blog saving
app.post("/save", upload.array('images'), (req, res) => {
    const { name, blog } = req.body;
    // console.log(req.body);
     console.log(req.files);
    const images = req.files.map(file => file.buffer); // Convert uploaded files to Buffers (binary data)
    console.log(images);
    db.query(
        "INSERT INTO blogs (blog_topic, blog, images) VALUES ($1, $2, $3)",
        [name, blog, images],
        (err, result) => {
            if (err) {
                console.error("Error saving blog:", err.stack);
                res.status(500).send("Error saving blog");
            } else {
                blogs.push(req.body);
                console.log(blogs);
                res.sendFile(__dirname + "/public/new.html");
            }
        }
    );
});

app.get("/Read", (req, result) => {
    db.query("SELECT * FROM blogs", (err, res) => {
        if (err) {
            console.error("Error executing query", err.stack);
        } else {
            result.render("Read.ejs", {
                files: res.rows
            });
        }
    });
});

app.get("/forgot_password", (req, res) => {
    res.sendFile(__dirname + "/public/resetpassword.html");
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

app.get("/backtohomepage", (req, res) => {
    res.sendFile(__dirname + "/public/homepage.html");
});
app.get("/Logout",(req,res)=>{
    res.sendFile(__dirname + "/public/index.html");
});
