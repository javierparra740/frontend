import { createBrowserRouter } from "react-router-dom";
import Login from "../components/auth/Login/Login";
import Register from "../components/auth/Register/Register";
import CreateProject from "../components/project/CreateProject";

export const router = createBrowserRouter([
    {
        path: "/login",
        element: <Login />,
    },
    {
        path: "/register",
        element: <Register />,
    },
    {
        path: "/",
        element: <Login />,
    },
    {
        path: "/projects/new",
        element: <CreateProject />,
    }
]);
