import {Button, Card, Col, Container, Form, Row} from "react-bootstrap";
import React, {useContext, useEffect, useState} from "react";
import {AuthContext} from "./AuthContext";
import {Link, useNavigate} from "react-router-dom";
import {BACKEND_URL} from "../constants/Constants";
const Login: React.FC = () => {
    const {authenticated, setAuthenticated} = useContext(AuthContext);
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [isError, setIsError] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        const response = await fetch( '/api/auth/authenticate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({email, password}),
        });

        if (response.ok) {
            const data = await response.json();
            console.log(data);
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);

            setAuthenticated(true);
            setIsError(false)
            console.log("Authenticated: " + authenticated);
            navigate("/");

        } else {
            setIsError(true)
            console.log("Error: " + response);
        }
    }

    return (
        <section className="vh-100 gradient-custom">
        <Container className="py-5 h-100">
            <Row className="d-flex justify-content-center align-items-center h-100">
                <Col xs={12} md={8} lg={6} xl={5}>
                    <Card className="bg-dark text-white" style={{ borderRadius: '1rem' }}>
                        <Card.Body className="p-5 text-center">
                            <div className="mb-md-5 mt-md-4 pb-5">
                                <h2 className="fw-bold mb-4 text-uppercase">Login</h2>
                                <Form onSubmit={handleLogin}>
                                    <Form.Group controlId="formEmail" className="mb-4">
                                        <Form.Control
                                            className="basic-addon1"
                                            type="email"
                                            name="email"
                                            placeholder="Email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </Form.Group>

                                    <Form.Group controlId="formPassword" className="mb-4">
                                        <Form.Control
                                            className="basic-addon1"
                                            type="password"
                                            name="password"
                                            placeholder="Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </Form.Group>
                                    <Button variant="outline-light" size="lg" className="px-5 mt-2" type="submit">
                                        Login
                                    </Button>
                                </Form>
                                <p className="small mb-5 pb-lg-2">
                                    <p className="mb-0 mt-4">
                                        Don't have an account? <Link to="/register" className="text-white">
                                        Sign up
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

export default Login;