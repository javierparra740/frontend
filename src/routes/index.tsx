import { createBrowserRouter} from "react-router-dom";
import Login from "../components/auth/Login/Login";
import Register from "../components/auth/Register/Register";
import CreateProject from "../components/project/CreateProject";
<<<<<<< HEAD
import KanbanCard from "../components/kanban/KanbanCard/KanbanCard";
=======
import GeoMapViewer from "../components/map/Map2D/Map2D";
>>>>>>> 3152733d631af9973ab140985b79ccefacc8f8ba

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
<<<<<<< HEAD
        path:"/task/new",
        element:<KanbanCard task={{id:"1", title:"tarea uno", assignee: undefined, dueDate:"", status:"ToDo", description:""}}/>
    },
=======
        path: "/geo/2d",
        element: <GeoMapViewer />,
    }
>>>>>>> 3152733d631af9973ab140985b79ccefacc8f8ba
]);
