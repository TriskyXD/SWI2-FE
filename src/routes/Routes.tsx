import {Navigate, Outlet, Route, Routes as Router} from "react-router-dom";
import Login from "../auth/Login";
import Register from "../auth/Register";
import MainPage from "../pages/MainPage";
import {useContext} from "react";
import {AuthContext, AuthProvider} from "../auth/AuthContext";

type Props = {}

const PrivateRoutes = () => {
    const {authenticated} = useContext(AuthContext)
    if(!authenticated) return <Navigate to="/login" replace />

    return <Outlet/>
}
const Routes = (props: Props) => {
    return (
        <AuthProvider>
            <Router>
                    <Route path='*' element={<Navigate to='/login' replace />} />
                    <Route path="/login" element={<Login/>}></Route>
                    <Route path="/register" element={<Register/>}></Route>
                    <Route element={<PrivateRoutes/>}>
                        <Route path="/" element={<MainPage></MainPage>}></Route>
                    </Route>
            </Router>
        </AuthProvider>


    )
}

export default Routes;