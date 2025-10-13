import { createBrowserRouter} from "react-router-dom";
import Login from "../components/auth/Login/Login";
import Register from "../components/auth/Register/Register";
import CreateProject from "../components/project/CreateProject";
import GeoMapViewer from "../components/map/Map2D/Map2D";

export const router = createBrowserRouter([
    /* {
        path:"/",
        redirectTo: "/login"
    }, */
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
    },
    {
        path: "/geo/2d",
        element: <GeoMapViewer />,
    }
]);
