require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
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
    database: process.env.database,
});

db.connect((error) => {
    if (error) {
        log(`MySQL connection error: ${error.message}`);
        throw error;
    }
    log('Visitors Database connected successfully');
});

app.post('/ussd', (req, res) => {
    const {Mobile, sessionId, serviceCode, Type, Message, Operator } = req.body;
    const input = Message;
    let response = {};
    db.query(
        'SELECT session_state FROM visitor_log WHERE session_id = ?',
        [sessionId],
        (error, results) => {
            if (error) {
                log(`Error retrieving session_state for ${sessionId}: ${error.message}`);
                return res.send({
                    Type: `Release`,
                    Message: `Error`
                });
            }
            if(results.length>0)
            {
                sessionState = results[0].session_state;
            }else{
                sessionState = 0;
            }
            
        }
    );
    log(`Received request: sessionId=${sessionId}, serviceCode=${serviceCode}, phoneNumber=${Mobile}, text=${Message}, Type=${Type}, Operator=${Operator}`);

    const stringRegex = /^[a-zA-Z\s]+$/;

    const numRegex = /^\d+$/;
    
    
    if (Type === 'initiation') {
        response = {
            Type: `Response`,
            Message: `Welcome to Emergent Payments Visitor Portal\n1.Check-in\n2. Check-out`
        };
        log(`Session started: ${sessionId}`);
        res.set('Content-Type', 'application/json');
        res.send(response);
    }
    if (Message === '1') {
        db.query(
            'INSERT INTO visitor_log (session_id, session_state) VALUES (?, 0)',
            [sessionId],
            (error) => {
                if (error) {
                    log(`Error inserting session for ${sessionId}: ${error.message}`);
                    return res.send({
                        Type: `Release`,
                        Message: `Error`
                    });
                }
            }
        );
        response = {
            Type: `Response`,
            Message: `Enter your Name:`
        };
        res.set('Content-Type', 'application/json');
        res.send(response);
    } else if (Message === '2') {
        db.query(
            'INSERT INTO visitor_log (session_id, session_state) VALUES (?, 6)',
            [sessionId],
            (error) => {
                if (error) {
                    log(`Error inserting session for ${sessionId}: ${error.message}`);
                    return res.send({
                        Type: `Release`,
                        Message: `Error`
                    });
                }
            }
        );
        response = {
            Type: `Response`,
            Message: `Enter your Visit Code: `
        };
        res.set('Content-Type', 'application/json');
        res.send(response);
    }
    else if (sessionState === 6) {
        const exitCode = Message;
        if (!numRegex.test(exitCode) || exitCode.length !== 10) {
            response = {
                Type: `Response`,
                Message: `Invalid exit code. Please try again\n(Exit code should be 10 digits):`
            };
            log(`Invalid exit code for ${sessionId}: ${visitCode}`);
                    res.set('Content-Type', 'application/json');
                    res.send(response);
                    return;
                }
                db.query(
                    'SELECT * FROM visitor_log WHERE Phone_Number = ? AND session_state = 5',
                    [Mobile],
                    (error, results) => {
                        if (error) {
                            log(`Error retrieving details for ${sessionId}: ${error.message}`);
                            return res.send({
                                Type: `Release`,
                                Message: `Error`
                            });
                        }
                        if (results.length === 0) {
                            log(`No record found for number: ${Mobile}`);
                            response = {
                                Type: `Response`,
                                Message: `Please check-in first`
                            };
                            res.set('Content-Type', 'application/json');
                            res.send(response);
                            return;
                        }
                        else
                        {
                            if(results[0].code !== exitCode) {
                                log(`Invalid exit code for ${sessionId}: ${exitCode}`);
                                response = {
                                    Type: `Response`,
                                    Message: `Invalid exit code. Please try again`
                                };
                                res.set('Content-Type', 'application/json');
                                res.send(response);
                                return;
                            }
                            else{
                                db.query(
                                    'DELETE FROM visitor_log WHERE Phone_Number = ?',
                                    [Mobile],
                                    (error) => {
                                        if (error) {
                                            log(`Error deleting record for user ${Mobile}: ${error.message}`);
                                            return res.send({
                                                Type: `Release`,
                                                Message: `Error`
                                            });
                                        }
                                        log(`Check-out successful for user: ${Mobile}`);
                                        response = {
                                            Type: `Release`,
                                            Message: `Check-out successful. Goodbye!`
                                        };
                                        res.set('Content-Type', 'application/json');
                                        res.send(response);
                                    }
                                );
                            }
                        }
                    }
                );
                return;
            }
    else if (sessionState === 0) {
        const name = Message;

        if (!stringRegex.test(name) || name.length < 3) {
            response = {
                Type: `Response`,
                Message: `Invalid name format. Please try again\n(Name should be more than 3 letters and contain only letters and spaces):`
            };
            log(`Invalid name input for ${sessionId}: ${name}`);
            res.set('Content-Type', 'application/json');
            res.send(response);
        } else {
            db.query(
                'INSERT INTO visitor_log (session_id, session_state, Name) VALUES (?, 1, ?)',
                [sessionId, name],
                (error) => {
                    if (error) {
                        log(`Error storing name for ${sessionId}: ${error.message}`);
                        return res.send({
                            Type: `Release`,
                            Message: `Error`
                        });
                    } else {
                        log(`Name saved for ${sessionId}: ${name}`);
                        response = {
                            Type: `Response`,
                            Message: `Enter your Phone Number(02XXXXXXXX):`
                        };
                    }
                    res.set('Content-Type', 'application/json');
                    res.send(response);
                }
            );
        }
    } else if (sessionState === 1) {
        const phone = Message;
        if (!numRegex.test(phone) || phone.length !== 10) {
            response = {
                Type: `Response`,
                Message: `Invalid phone number. Please try again\n (Phone number should be contain only 10 digits):`
            };
            log(`Invalid phone input for ${sessionId}: ${phone}`);
            res.set('Content-Type', 'application/json');
            res.send(response);
        } else {
            db.query(
                'UPDATE visitor_log SET session_state = 2, Phone_Number = ? WHERE session_id = ?',
                [phone, sessionId],
                (error) => {
                    if (error) {
                        log(`Error storing phone for ${sessionId}: ${error.message}`);
                        return res.send({
                            Type: `Release`,
                            Message: `Error`
            });
                    } else {
                        log(`Phone saved for ${sessionId}: ${phone}`);
                        response = {
                            Message: 'Reason for Visit: '
                        };
                    }
                res.set('Content-Type', 'application/json');
                res.send(response);
            }
        );
    }
} else if (sessionState === 2) {
    const reason = Message;
    if (!stringRegex.test(reason)) {
        response = {
            Type: `Response`,
            Message: `Invalid reason format\n Reason should only contain letters and spaces:`
        };
        log(`Invalid reason input for ${sessionId}: ${reason}`);
        res.set('Content-Type', 'application/json');
        res.send(response);
    } else {
            db.query(
                'UPDATE visitor_log SET session_state = 3, reason = ? WHERE session_id = ?',
                [reason, sessionId],
                (error) => {
                    if (error) {
                        log(`Error storing reason for ${sessionId}: ${error.message}`);
                        return res.send({
                            Type: `Release`,
                            Message: `Error`
                        });
                    } else {
                        log(`Reason saved for ${sessionId}: ${reason}`);
                        response = {
                            Type: `Response`,
                            Message: 'Who are you visiting?'
                        };
                    }
                res.set('Content-Type', 'application/json');
                res.send(response);
            }
        );
    }
} else if (sessionState === 3) {
    const person = Message;
    if (!stringRegex.test(person)) {
        response = {
            Type: `Response`,
            Message: `Invalid input\nShould only contain letters and spaces:`
        };
        log(`Invalid person input for ${sessionId}: ${input}`);
        res.set('Content-Type', 'application/json');
        res.send(response);
    } else {
        db.query(
            'UPDATE visitor_log SET session_state = 4, visitor = ? WHERE session_id = ?',
            [person, sessionId],
            (error) => {
                if (error) {
                    log(`Error storing visitor for ${sessionId}: ${error.message}`);
                    return res.send({
                        Type: `Release`,
                        Message: `Error`
                    });
                }

                db.query(
                    'SELECT Name, Phone_Number, reason, visitor FROM visitor_log WHERE session_id = ?',
                    [sessionId],
                    (error, results) => {
                        if (error) {
                            log(`Error retrieving data for ${sessionId}: ${error.message}`);
                            return res.send({
                                Type: `Release`,
                                Message: `Error`
                            });
                        }
                        if (results.length === 0) {
                            log(`No record found for sessionId: ${sessionId}`);
                            return res.send('END Error: No record found');
                        }
                        const visitor = results[0];
                        log(`Data retrieved for ${sessionId}: ${JSON.stringify(visitor)}`);
                        response = {
                            Type: `Response`,
                            Message: `CON Confirm:\nName: ${visitor.Name}\n
                            Phone: ${visitor.Phone_Number}\n
                            Visiting: ${visitor.reason}\n
                            Purpose: ${visitor.visitor}\n\n
                            1 to confirm\n
                            2 to cancel`
                        };
                        res.set('Content-Type', 'application/json');
                        res.send(response);
                    }
                );
            }
        );
    }
} else if (sessionState === 4) {
    const answer = Message;
    if (!numRegex.test(answer)) {
        response = {
            Type: `Response`,
            Message: `Invalid response\nPlease enter 1 to confirm or 2 to cancel:`
        };
        log(`Invalid reason input for ${sessionId}: ${reason}`);
        res.set('Content-Type', 'application/json');
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
                        return res.send({
                            Type: `Release`,
                            Message: `Error`
                        });
                    } else {
                        log(`Code saved for ${sessionId}: ${result}`);
                        response = {
                            Type: `Release`,
                            Message: `Check-in successful. Your code is ${result}`
                        };
                    }
                res.set('Content-Type', 'application/json');
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
                    return res.send({
                        Type: `Release`,
                        Message: `Error`
                    });
                } else {
                    log(`Record deleted for ${sessionId}`);
                    response = {
                        Type: `Release`,
                        Message: 'Check-in cancelled'
                    };
                }
                res.set('Content-Type', 'application/json');
                res.send(response);
            }
        );
    }
    }
}
});

const PORT = process.env.Port || 3002;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`USSD server running on port ${PORT}`);
    log(`Server started on port ${PORT}`);
});