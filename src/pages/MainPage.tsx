import {
    Button,
    Card,
    Col,
    Container,
    Form,
    Modal,
    Nav,
    Navbar,
    NavDropdown, NavLink,
    OverlayTrigger,
    Row,
    Tooltip
} from "react-bootstrap";
import {useNavigate} from "react-router-dom";
import React, {useContext, useEffect, useState} from "react";
import {AuthContext} from "../auth/AuthContext";
import {BACKEND_URL} from "../constants/Constants";
import {CompatClient, Stomp} from '@stomp/stompjs';
import SockJS from "sockjs-client";
import {ChatMessage} from "../models/ChatMessage";
import {ChatObject} from "../models/ChatObject";
import {ChatUser} from "../models/ChatUser";
import {ChatUsers} from "../models/ChatUsers";
import {DisplayedMessage} from "../models/DisplayedMessage";
import * as Icon from 'react-bootstrap-icons';
import {wait} from "@testing-library/user-event/dist/utils";
import 'react-toastify/dist/ReactToastify.css';
// @ts-ignore
import {toast, ToastContainer} from "react-toastify";
import {top} from "@popperjs/core";

const MainPage = () => {
    const [helperRender, setHelperRender] = useState<boolean>(true);

    const [stompClient, setStompClient] = useState<CompatClient | null>(null);
    const [chats, setChats] = useState<ChatObject[]>([]);
    const [user, setUser] = useState<ChatUser>();
    const [selectedChat, selectChat] = useState<ChatObject| undefined>(undefined);

    const [message, setMessage] = useState<string>('');

    const [showUsersModal, setShowUsersModal] = useState(false);
    const [addUserModal, setAddUserModal] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState("");

    const [createChatModal, setCreateChatModal] = useState(false);
    const [newChatName, setNewChatName] = useState("");

    const navigate = useNavigate();
    const {setAuthenticated} = useContext(AuthContext);


    useEffect(() => {

        const token = getAccessTokenFromLocalStorage();
        if(token === null) return;

        initializeWebSocket(token);

        return () => {
            if (stompClient && stompClient.connected) {
                stompClient.disconnect();
            }
        };
    }, []);

    const initializeWebSocket = async (token:string) => {
        try {
            const response = await fetch( '/api/chat/exchanges', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Chats from user: ', data);
                setChats(prevState => {
                    prevState = data;
                    prevState.forEach(c => c.messages = [])
                    return prevState;
                });
                connectWebSocket(token, data);
            } else {
                console.error('Failed to fetch chats:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching queues:', error);
        }
    };
    const getUserData = async (client: CompatClient) => {
        const token = getAccessTokenFromLocalStorage();
        if (token === null) return;

        try {
            const response = await fetch('/api/user', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                console.log('User: ', data);
                setUser(data);
                subscribeToUser(client, data);
            } else {
                console.error('Failed to fetch user:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching user:', error);
        }
    }

    async function closeConsumers() {
        const token = getAccessTokenFromLocalStorage();
        if (!token) return;

        const response = await fetch(   '/api/chat/close-consumers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        if (response.ok) {
            console.log("Consumers closed.")
        } else {
            console.error('Failed to fetch user:', response.statusText);
        }

    }
    const connectWebSocket = (token: string, data: ChatObject[]) => {
        const client = Stomp.over(() => new SockJS(BACKEND_URL + '/ws-message'));
        client.configure({
            reconnectDelay: 10000,
        });

        const headers = {
            Authorization: `Bearer ${token}`,
        };

        client.connect(headers, async () => {
            console.log('Connected to WebSocket');
            setStompClient(client);
            subscribeToQueues(client, data);
            subscribeToExchanges(client, data);
            await getUserData(client);
        });

        client.onWebSocketClose(() => {
            closeConsumers();
            setStompClient(null);
            console.log('Disconnected from WebSocket');
        });
    };

    const subscribeToUser = (client: CompatClient, _user: ChatUser) => {

        const destination = `/chat/user/${_user.id}`;
        client.subscribe(destination, (message) =>{
            const _chat: ChatObject = JSON.parse(message.body);
            if(_chat.chat.id === -1){
                setChats(prevState => {
                    const toRemove = prevState.find(value => value.chat.exchange === _chat.chat.exchange);
                    const index = prevState.indexOf(toRemove!);
                    if (index > -1) {
                        toRemove?.queues.forEach((queue) =>{
                            stompClient?.unsubscribe(`/chat/queue/${queue}`);
                        })
                        stompClient?.unsubscribe(`/chat/exchange/${toRemove?.chat.exchange}`);
                        prevState.splice(index, 1);
                    }
                    return prevState;
                });
                selectChat(undefined);
            }
            else{
                console.log(_chat);
                _chat.messages = [];
                setChats(prevState => {
                    prevState.push(_chat);
                    return prevState;
                })
                _chat.queues.forEach((queue) =>{
                    subscribeToQueue(client, queue, _chat);
                })
                subscribeToExchanges(client, [_chat]);
            }
            rerender();
        });
        console.log("Subscribing to: " + destination);
    }
    const subscribeToExchanges = (client: CompatClient, data: ChatObject[]) => {
        console.log("Subscribing to exchanges");
        data.forEach(c =>{
            client.subscribe(`/chat/exchange/${c.chat.exchange}`, (message) =>{
                const _user: ChatUser = JSON.parse(message.body);
                let userChangeMessage: DisplayedMessage;
                if(_user.id === -1){
                    userChangeMessage = {
                        sender: _user,
                        type: "Leave",
                        content: _user.firstName + " " + _user.lastName + " has left the chat."
                    }
                    setChats(prevState => {
                        const _chat = prevState.find(value => value.chat.id === c.chat.id);
                        _chat?.messages.push(userChangeMessage);
                        return prevState;
                    });
                }
                else{
                    userChangeMessage = {
                        sender: _user,
                        type: "Join",
                        content: _user.firstName + " " + _user.lastName + " has joined the chat."
                    }
                    setChats(prevState => {
                        const _chat = prevState.find(value => value.chat.id === c.chat.id);
                        _chat?.messages.push(userChangeMessage);
                        const newUser:ChatUsers = {
                            user: _user,
                            queue: "",
                            id: -1
                        };
                        if(_chat?.chat.userQueues.find(uq => uq.user.id === newUser.id) !== null){
                            _chat?.chat.userQueues.push(newUser);
                        }
                        return prevState;
                    });
                }
                rerender();
            })
        })
    }
    const subscribeToQueue = (client: CompatClient, queue: string, chat: ChatObject)=> {
        client.subscribe(`/chat/queue/${queue}`, (message) => {
            console.log(message);
            try {
                const body: ChatMessage = JSON.parse(message.body);
                console.log('Received message from user: ' + body.senderId + ", in chat: " + body.chatId + ", msg: " + body.content);
                const newMessage: DisplayedMessage = {
                    sender: chat.chat.userQueues.find(uq => uq.user.id === body.senderId)!.user,
                    content: body.content,
                    type: body.type
                }

                setChats((prevChats) => {
                    const foundChat = prevChats.find((prevChat) => prevChat.chat.id === chat.chat.id);
                    foundChat?.messages.push(newMessage);
                    if(selectedChat?.chat.id !== foundChat?.chat.id) {
                        foundChat!.seen = false;
                        wait(10).then(val => selectChat(prevState => prevState));
                    }
                    return prevChats;
                });
                rerender();

            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });
    }
    const subscribeToQueues = (client: CompatClient, data: ChatObject[]) => {
        console.log('Subscribing To queues');
        data.forEach((chat) => {
            chat.queues.forEach((queue) => {
                subscribeToQueue(client, queue, chat);
            });
        });
    };
    const rerender = () =>{
        setHelperRender(false);
        wait(0).then(value =>setHelperRender(true));
        wait(50).then(value => {
            const lastMessage = document.getElementById("lastMessage");
            console.log(lastMessage);
            lastMessage?.scrollIntoView({behavior: 'auto', block: 'end',inline: "end"});
        });
    }
    const logout = async () => {

        const response = await fetch( '/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem("access_token")
            },
        });
        if(response.ok){
            closeConsumers();
            stompClient?.disconnect();
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            setAuthenticated(false);
            navigate("/login");
            console.log("Logging out");
        }
    }
    const handleSend = async () => {
        if (message.trim() !== '') {

            const chatMessage: ChatMessage = {
                type: 'Text',
                chatId: selectedChat!.chat.id,
                content: message,
                senderId: selectedChat!.chat.owner.id
            };

            try {
                const token = localStorage.getItem("access_token");
                const response = await fetch( "/api/chat/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify(chatMessage),
                });

                if (response.ok) {
                    console.log('Message was sent successfully');
                } else {
                    console.error('Message sending failed:', response.statusText);
                }
            } catch (error) {
                console.error('Message sending error:', error);
            }

            setMessage('');
        }
    };
    function openChat(e: React.MouseEvent<HTMLButtonElement>, c: ChatObject) {
        selectChat(prevState => {
            prevState = c;
            prevState.seen = true;
            return prevState;
        });
    }
    function renderChatButton(c: ChatObject) {
        let displayedMessage = "";

        if (c.messages && c.messages.length > 0) {
            const message = c.messages[c.messages.length - 1];

            if (message.type === "Text") {
                displayedMessage = message.sender.firstName + ": " + message.content;
            } else {
                displayedMessage = message.content;
            }

            if (displayedMessage.length > 15) {
                displayedMessage = displayedMessage.substring(0, 15) + "...";
            }
        }

        return (
            <Button
                onClick={(e) => openChat(e, c)}
                className={"w-100 mt-1 mb-1 text-start"}
                key={c.chat.exchange}
                style={{ background: 'black', color: 'white', border: 'black' }}
            >
                <span className={"h5"}> {c.chat.chatName} </span><br />
                <span className={c.seen ? "" : "fw-bold"}> {displayedMessage} </span>
            </Button>
        );
    }

    const renderTooltip = (props:ChatUser) => (
        <Card className={"position-absolute py-2 px-3"}>
            <Card.Title><Icon.PersonFill/>{" " +props.email}</Card.Title>
            <Card.Text>{props.firstName + " " + props.lastName}</Card.Text>
        </Card>
    );
    const renderMessages = ()=> {

        if(selectedChat === undefined || selectedChat.messages === undefined) return <></>;

        return <>
            {selectedChat.messages.map((msg, index) => {
                const isCurrentUser = msg.sender?.id === user?.id;

                let message;
                if(msg.type === "Join" ){
                    message = <Card
                        key={index}
                        className={`my-3 w-100 bg-dark-subtle`}
                    >
                        <OverlayTrigger overlay={renderTooltip(msg.sender)} placement={"top-start"} delay={{ show: 250, hide: 400 }}>
                            <Card.Text className={"p-2"}>{msg.content}</Card.Text>
                        </OverlayTrigger>
                    </Card>;
                }
                else if(msg.type === "Leave"){
                    message = <Card
                        key={index}
                        className={`my-3 w-100 bg-body-tertiary`}
                    >
                        <OverlayTrigger overlay={renderTooltip(msg.sender)} placement={"top-start"} delay={{ show: 250, hide: 400 }}>
                            <Card.Text className={"p-2"}>{msg.content}</Card.Text>
                        </OverlayTrigger>
                    </Card>;
                }
                else {
                    message = <Card
                        key={index}
                        className={`my-3 ${isCurrentUser ? 'ms-auto bg-dark-subtle' : ''}`}
                        style={{maxWidth: '400px'}}
                    >
                        <Card.Body>
                            <OverlayTrigger overlay={renderTooltip(msg.sender)} placement={"top-start"} delay={{ show: 250, hide: 400 }}>
                                <Card.Title className="mb-2 h5">
                                    {`${msg.sender?.firstName} ${msg.sender?.lastName}`}
                                </Card.Title>
                            </OverlayTrigger>
                            <Card.Text>{msg.content}</Card.Text>
                        </Card.Body>
                    </Card>
                }
                return (
                    message
                );
            })}
            <div id={"lastMessage"}>
            </div>
        </>;
    }

    const handleShowUsersClick = () => {
        setShowUsersModal(true);
    };

    const handleAddUserClick = () => {
        setAddUserModal(true);
    };

    function handleCreateChatClick() {
        setCreateChatModal(true);
    }

    function handleCloseCreateChatModal() {
        setCreateChatModal(false);
    }

    const handleCloseUsersModal = () => {
        setShowUsersModal(false);
    };

    const handleCloseAddUserModal = () => {
        setAddUserModal(false);
    };

    const handleAddUserSubmit = async (e: any) => {
        e.preventDefault();

        try {
            const token = getAccessTokenFromLocalStorage();
            if(!token) return;

            const response = await fetch(`/api/chat/add?chatId=${selectedChat?.chat.id}&email=${newUserEmail}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const msg = 'Added user: ' + newUserEmail;
                console.log(msg);
                toast.success(msg, {autoClose: 3000});
            } else {
                const msg = 'Cannot add user: ' + newUserEmail;
                toast.error(msg,  {autoClose: 3000});
                console.error('Message sending failed:', response.statusText);
            }
        } catch (error) {
            console.error('Message sending error:', error);
        }
        handleCloseAddUserModal();
    };

    const handleCreateChatSubmit = async (e: any) => {
        e.preventDefault();

        try {
            const token = getAccessTokenFromLocalStorage();
            if(!token) return;

            const response = await fetch(`/api/chat/create?chatName=${newChatName}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const msg = 'Created chat: ' + newChatName;
                console.log(msg);
                toast.success(msg, {autoClose: 3000});
                setNewChatName("");
            } else {
                const msg = "Cannot create chat: " + newChatName;
                toast.error(msg,  {autoClose: 3000});
                console.error(msg, response.statusText);
            }
        } catch (error) {
            console.error('Message sending error:', error);
            toast.error("Cannot create chat",  {autoClose: 3000});
        }
        handleCloseCreateChatModal();
    };
    function renderAddUserModal() {
        return <Modal show={addUserModal} onHide={handleCloseAddUserModal}>
            <Modal.Header closeButton>
                <Modal.Title>Add user to the chat room</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleAddUserSubmit}>
                    <Form.Group controlId="formBasicEmail">
                        <Form.Label>Email address</Form.Label>
                        <Form.Control
                            type="email"
                            placeholder="Enter email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                        />
                    </Form.Group>
                    <Button variant="dark" type="submit" className={"mt-2"}>
                        Add
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>;
    }
    function renderCreateChatModal() {
        return <Modal show={createChatModal} onHide={handleCloseCreateChatModal}>
            <Modal.Header closeButton>
                <Modal.Title>New chat</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleCreateChatSubmit}>
                    <Form.Group>
                        <Form.Label>Chat name</Form.Label>
                        <Form.Control
                            placeholder="Enter chat name"
                            value={newChatName}
                            onChange={(e) => setNewChatName(e.target.value)}
                        />
                    </Form.Group>
                    <Button variant="dark" type="submit" className={"mt-2"}>
                        Create
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>;
    }
    async function handleDeleteUser(_user: ChatUser) {
        try {
            const token = getAccessTokenFromLocalStorage();
            if(!token) return;
            const response = await fetch(`/api/chat/remove?chatId=${selectedChat?.chat.id}&userId=${_user.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                console.log(`Removed user ${_user.id} from chat ${selectedChat?.chat.id}`);
                toast.success(`Removed user ${_user.email} from chat ${selectedChat?.chat.chatName}`, {autoClose: 3000});
                if(user?.id === _user.id) selectChat(prevState => prevState = undefined);
                handleCloseUsersModal();
            } else {
                console.error('Failed to fetch chats:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching queues:', error);
        }
    }
    function renderShowUsersModal() {
        return <Modal show={showUsersModal} onHide={handleCloseUsersModal}>
            <Modal.Header closeButton>
                <Modal.Title>Chat users</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {helperRender? selectedChat &&
                    selectedChat.chat.userQueues.map((userQueue) => (
                        <Card key={userQueue.user.id}
                              className={(user?.id === userQueue.user.id) ? "bg-dark-subtle" : ""}>
                            <Card.Text className={"px-3 pt-1"}
                                       style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span>
                                        <span className={"fw-bold"}>
                                            {userQueue.user.firstName + " " + userQueue.user.lastName}
                                        </span>
                                        {userQueue.user.id === selectedChat.chat.owner.id ? (
                                        <span className={"text-body-tertiary"}>{" - owner"}</span>
                                        ) : (
                                        <></>
                                        )}
                                    </span>

                                {user?.id === selectedChat.chat.owner.id ? <OverlayTrigger overlay={
                                    <Tooltip placement={top}>
                                        {"Remove " + userQueue.user.firstName + " " + userQueue.user.lastName + " from room " + selectedChat.chat.chatName}
                                    </Tooltip>
                                } delay={{show: 250, hide: 400}}>
                                <span
                                    className={"px-2 text-danger"}
                                    style={{cursor: "pointer"}}
                                    onClick={() => handleDeleteUser(userQueue.user)}
                                >
                                    <Icon.XCircleFill/>
                                </span></OverlayTrigger> : <></>}
                            </Card.Text>
                            <Card.Text className={"px-3 pb-1"}>{userQueue.user.email}</Card.Text>
                        </Card>
                    )) : <></> }
            </Modal.Body>
        </Modal>;
    }

    const renderChatBody = () => {
        return selectedChat ?
            <>
                <Container fluid className={"d-flex mt-3 align-items-center"}>
                    <h3 className={"flex-grow-1 mt-1"}>{selectedChat.chat.chatName}</h3>
                    {selectedChat.chat.owner.id === user?.id? <OverlayTrigger
                        placement="top"
                        delay={{show: 250, hide: 400}}
                        overlay={<Tooltip>Add user</Tooltip>}
                    >
                        <span className={"px-2 fs-4"} style={{cursor: "pointer"}}
                              onClick={handleAddUserClick}><Icon.Plus></Icon.Plus></span>
                    </OverlayTrigger> : <></>}
                    <OverlayTrigger
                        placement="top"
                        delay={{ show: 250, hide: 400 }}
                        overlay={ <Tooltip>Show users</Tooltip>}
                    >
                        <span className={"ms-1 px-2 fs-4"} style={{cursor: "pointer"}} onClick={handleShowUsersClick}><Icon.PersonFill></Icon.PersonFill></span>
                    </OverlayTrigger>
                </Container>
                <hr/>
                <Container className={"flex-grow overflow-auto"}>
                    {helperRender? renderMessages() : <></>}
                </Container>
                <Row className={"mt-auto pb-5 mb-5"}>
                    <hr style={{ marginBottom: '28px' }} />
                    <Col xs={10} sm={11}>
                        <Form onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}>
                            <Form.Group>
                                <Form.Control
                                    type="text"
                                    placeholder="Type a message..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </Form.Group>
                        </Form>
                    </Col>
                    <Col xs={2} sm={1}>
                        <Button type="submit" onClick={handleSend} style={{ background: 'black', color: 'white', border: 'black' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                                 className="bi bi-send" viewBox="0 0 16 16">
                                <path
                                    d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z"/>
                            </svg>
                        </Button>
                    </Col>
                </Row>
            </> : <></>;
    }

    return(
        <div className={"vh-100"}>
            <Navbar className="bg-black">
                <Navbar.Brand href="#" className="ms-4">
                    <span style={{fontWeight: "bold", fontSize: "1.5rem", color: "#fff"}}>
                      ChatApp
                    </span>
                </Navbar.Brand>
                <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end me-4">
                    <Nav>
                        <Nav.Link as={NavLink} onClick={logout}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="red"
                                 className="bi bi-box-arrow-right" viewBox="0 0 16 16">
                                <path fill-rule="evenodd"
                                      d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"/>
                                <path fill-rule="evenodd"
                                      d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/>
                            </svg>
                        </Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Navbar>
            <Container fluid className={"h-100"}>
                <Row className={"row-fluid h-100"}>
                    <Col xs={4} sm={3} md={3} lg={2} style={{borderRight: '3px solid #000', overflowY:'auto'}}
                         className={"col-fluid h-100"}>
                        <div className={"mt-3"}>
                            <p>
                                <OverlayTrigger
                                    placement="top"
                                    delay={{show: 250, hide: 400}}
                                    overlay={<Tooltip>New chat</Tooltip>}
                                >
                                    <Icon.PlusSquareFill onClick={handleCreateChatClick} style={{cursor: "pointer"}} className={"text-dark me-2 mb-1"} />
                                </OverlayTrigger>
                            </p>
                        </div>
                        {
                            helperRender?
                            chats.map(c =>
                                renderChatButton(c)): <></>
                        }
                    </Col>
                    <Col xs={8} sm={9} md={9} lg={10} className={"col-fluid h-100"}>
                        <Container fluid className={"d-flex flex-column justify-content-start h-100"}>
                            {  renderChatBody() }
                        </Container>
                    </Col>
                </Row>
            </Container>
            {renderShowUsersModal()}
            {renderAddUserModal()}
            {renderCreateChatModal()}
            <ToastContainer></ToastContainer>

        </div>
    );
}

    function getAccessTokenFromLocalStorage() {
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.log('No access token found');
            return null;
        }
        return token;
    }
export default MainPage;