crequire('dotenv').config();
const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const path = require('path');
const app = express();


function log(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync('app.log', `${timestamp} - ${message}\n`);
}


app.use(express.urlencoded({ extended: true }));

const db = mysql.createConnection({
    host: process.env.Host_name,
    user: process.env.user_name,
    password: process.env.Password,
    database: process.env.database
});

db.connect((error) => {
    if (error) {
        log(`MySQL connection error: ${error.message}`);
        throw error;
    }
    log('Visitors Database connected successfully');
});

app.post('/ussd', (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text = '' } = req.body;
    const input = text.split('*');
    let response = '';
    log(`Received request: sessionId=${sessionId}, serviceCode=${serviceCode}, phoneNumber=${phoneNumber}, text=${text}`);

    const stringRegex = /^[a-zA-Z\s]+$/;

    const numRegex = /^\d+$/;
    
    
    if (text === '') {
        response = `CON  'Welcome to Emergent Payments Visitor Portal\nEnter your fullname:`;
        log(`Session started: ${sessionId}`);

    } else if (input.length === 1) {
        const name = input[0];

        if (!stringRegex.test(name) && name.length < 3) {
            response = `CON Invalid name format. Please try again\n(Name should contain be more than 3 letters and containon letters and spaces):`;
            log(`Invalid name input for ${sessionId}: ${name}`);
            res.set('Content-Type', 'text/plain');
            res.send(response);
        } else {
            db.query(
                'INSERT INTO visitor_log (session_id, session_state, Name) VALUES (?, 1, ?)',
                [sessionId, name],
                (error) => {
                    if (error) {
                        log(`Error storing name for ${sessionId}: ${error.message}`);
                        return res.send('END Error');
                    } else {
                        log(`Name saved for ${sessionId}: ${name}`);
                        response = `CON Enter your Phone Number(02XXXXXXXX): `;
                    }
                    res.set('Content-Type', 'text/plain');
                    res.send(response);
                }
            );
        }
    }
    else if (input.length === 2) {
    const phone = input[1];
    if (!numRegex.test(phone) && phone.length !== 10) {
        response = `CON Invalid phone number. Please try again\n (Phone number should be contain only 10 digits):`;
        log(`Invalid phone input for ${sessionId}: ${phone}`);
        res.set('Content-Type', 'text/plain');
        res.send(response);
    } else {
            db.query(
                'UPDATE visitor_log SET session_state = 2, Phone_Number = ? WHERE session_id = ?',
                [phone, sessionId],
                (error) => {
                    if (error) {
                        log(`Error storing phone for ${sessionId}: ${error.message}`);
                        return res.send('END Error');
                    } else {
                        log(`Phone saved for ${sessionId}: ${phone}`);
                        response = 'CON Reason for Visit: ';
                    }
                res.set('Content-Type', 'text/plain');
                res.send(response);
            }
        );
    }
}
else if (input.length === 3) {
    const reason = input[2];
    if (!stringRegex.test(reason)) {
        response = `CON Invalid reason format\n Reason should only contain letters and spaces:`;
        log(`Invalid reason input for ${sessionId}: ${reason}`);
        res.set('Content-Type', 'text/plain');
        res.send(response);
    } else {
            db.query(
                'UPDATE visitor_log SET session_state = 3, reason = ? WHERE session_id = ?',
                [reason, sessionId],
                (error) => {
                    if (error) {
                        log(`Error storing reason for ${sessionId}: ${error.message}`);
                        return res.send('END Error');
                    } else {
                        log(`Reason saved for ${sessionId}: ${reason}`);
                        response = 'CON Who are you visiting?';
                    }
                res.set('Content-Type', 'text/plain');
                res.send(response);
            }
        );
    }
} else if (input.length === 4) {
    const person = input[3];
    if (!stringRegex.test(person)) {
        response = `CON Invalid input\nShould only contain letters and spaces:`;
        log(`Invalid person input for ${sessionId}: ${input}`);
        res.set('Content-Type', 'text/plain');
        res.send(response);
    } else {
        db.query(
            'UPDATE visitor_log SET session_state = 4, person = ? WHERE session_id = ?',
            [person, sessionId],
            (error) => {
                if (error) {
                    log(`Error storing person for ${sessionId}: ${error.message}`);
                    return res.send('END Error');
                }

                db.query(
                    'SELECT Name, Phone_Number, reason, visitor FROM visitor_log WHERE session_id = ?',
                    [sessionId],
                    (error, results) => {
                        if (error) {
                            log(`Error retrieving data for ${sessionId}: ${error.message}`);
                            return res.send('END Error');
                        }
                        if (results.length === 0) {
                            log(`No record found for sessionId: ${sessionId}`);
                            return res.send('END Error: No record found');
                        }
                        const visitor = results[0];
                        response = `CON Confirm:\nName: ${visitor.Name}\n
                        Phone: ${visitor.Phone_Number}\n
                        Visiting: ${visitor.reason}\n
                        Purpose: ${visitor.person}\n\n
                        1 to confirm\n
                        2 to cancel`;
                        res.set('Content-Type', 'text/plain');
                        res.send(response);
                    }
                );
            }
        );
    }
} else if (input.length === 5) {
    const answer = input[4];
    if (!numRegex.test(answer)) {
        response = `CON Invalid response\nPlease enter 1 to confirm or 2 to cancel:`;
        log(`Invalid reason input for ${sessionId}: ${reason}`);
        res.set('Content-Type', 'text/plain');
        res.send(response);
    } else {
        if(answer == '1') {
            let result ='';
            const digits = '0123456789';

            for(let i = 0; i < 10; i++) {
                result += digits[Math.floor(Math.random() * digits.length)];
            }
            db.query(
                'UPDATE visitor_log SET session_state = 5, code = ? WHERE session_id = ?',
                [result, sessionId],
                (error) => {
                    if (error) {
                        log(`Error storing code for ${sessionId}: ${error.message}`);
                        return res.send('END Error');
                    } else {
                        log(`Code saved for ${sessionId}: ${result}`);
                        response = `CON Check-in successful. Your code is ${result}`;
                    }
                res.set('Content-Type', 'text/plain');
                res.send(response);
            }
        );

    }
    else {
        db.query(
            'DELETE FROM visitor_log WHERE session_id = ?',
            [sessionId],
            (error) => {
                if (error) {
                    log(`Error deleting record for ${sessionId}: ${error.message}`);
                    return res.send('END Error');
                } else {
                    log(`Record deleted for ${sessionId}`);
                    response = 'END Check-in cancelled';
                }
                res.set('Content-Type', 'text/plain');
                res.send(response);
            }
        );
    }
    }
}

});