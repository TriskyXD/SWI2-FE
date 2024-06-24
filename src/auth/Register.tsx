import {Button, Card, Col, Container, Form, Row} from "react-bootstrap";
import React, {useContext, useState} from "react";
import {AuthContext} from "./AuthContext";
import {Link, useNavigate} from "react-router-dom";
import {BACKEND_URL} from "../constants/Constants";

const Register: React.FC = () => {
    const {authenticated, setAuthenticated} = useContext(AuthContext);
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');

    const [isError, setIsError] = useState(false);


    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        const response = await fetch(BACKEND_URL + '/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({email, password, firstName, lastName}),
        });

        if (response.ok) {
            const data = await response.json();
            console.log(data);
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);

            setAuthenticated(true);
            setIsError(false)
            navigate("/");
        } else {
            console.log(response);
            setIsError(true)
        }
        console.log("Authenticated: " + authenticated);
    };

    return (
        <section className="vh-100 gradient-custom">
        <Container className="py-5 h-100">
            <Row className="d-flex justify-content-center align-items-center h-100">
                <Col xs={12} md={8} lg={6} xl={5}>
                    <Card className="bg-dark text-white" style={{ borderRadius: '1rem' }}>
                        <Card.Body className="p-5 text-center">
                            <div className="mb-md-5 mt-md-4 pb-5">
                                <h2 className="fw-bold mb-4 text-uppercase">Register</h2>
                                <Form onSubmit={handleRegister}>
                                    <Form.Group controlId="formFirstName" className="mb-4">
                                        <Form.Control
                                            type="text"
                                            name="firstName"
                                            placeholder="First name"
                                            aria-label="First name"
                                            className="basic-addon1"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            required
                                        />
                                    </Form.Group>
                                    <Form.Group controlId="formLastName" className="mb-4">
                                        <Form.Control
                                            type="text"
                                            name="lastName"
                                            placeholder="Last name"
                                            aria-label="Last name"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            required
                                        />
                                    </Form.Group>
                                    <Form.Group controlId="formEmail" className="mb-4">
                                        <Form.Control
                                            type="email"
                                            name="email"
                                            placeholder="Email"
                                            aria-label="Email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </Form.Group>
                                    <Form.Group controlId="formPassword" className="mb-4">
                                        <Form.Control
                                            type="password"
                                            name="password"
                                            placeholder="Password"
                                            aria-label="Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </Form.Group>
                                    <Button variant="outline-light" size="lg" className="px-5 mt-2" type="submit">
                                        Register
                                    </Button>
                                </Form>
                                <p className="small mb-5 pb-lg-2">
                                    <p className="mb-0 mt-4">
                                        Already have an account? <Link to="/login" className="text-white">
                                        Login
                                    </Link>
                                    </p>
                                </p>
                                {
                                    isError && (
                                        <p className="small mb-5 pb-lg-2">
                                            <p className="mb-0 mt-4">
                                                Error submitting
                                            </p>
                                        </p>
                                    )

                                }
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
        </section>
);
};

export default Register;