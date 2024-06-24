import {createContext, ReactNode, useState} from "react";
import {useNavigate} from "react-router-dom";

type Props = {
    children?: ReactNode
}

type IAuthContext = {
    authenticated: boolean;
    setAuthenticated: (newState: boolean) => void
}

const getTokenFromLocalStorage = () => {
    const token = localStorage.getItem("access_token");

    if (token) {
        try {
            const parsedToken = JSON.parse(atob(token.split(".")[1]));
            const expirationTime = parsedToken.exp * 1000;

            if (expirationTime > Date.now()) {
                const remainingTimeInSeconds = Math.floor((expirationTime - Date.now()) / 1000);

                console.log("Remaining time in seconds:", remainingTimeInSeconds);

                return token;
            } else {
                console.warn("Token has expired. Removing from localStorage.");
                localStorage.removeItem("access_token");
            }
        } catch (error) {
            console.error("Error parsing or checking token:", error);
            console.warn("Removing invalid token from localStorage.");
            localStorage.removeItem("access_token");
        }
    }

    return null;
};

const initialValue = {
    authenticated: (getTokenFromLocalStorage() !== null),
    setAuthenticated: () => {}
}

const AuthContext = createContext<IAuthContext>(initialValue);

const AuthProvider = ({children}: Props ) => {
    const [authenticated, setAuthenticated] = useState(initialValue.authenticated);
    const navigate = useNavigate();

    return(
      <AuthContext.Provider value={{authenticated, setAuthenticated}}>
          {children}
      </AuthContext.Provider>
    );
}

export {AuthContext, AuthProvider};