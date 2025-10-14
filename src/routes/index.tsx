import { createBrowserRouter} from "react-router-dom";
import Login from "../components/auth/Login/Login";
import Register from "../components/auth/Register/Register";
import CreateProject from "../components/project/CreateProject";



import GeoMapViewer from "../components/map/Map2D/GeoMapViewer";


import KanbanCard from "../components/kanban/KanbanCard/KanbanCard"



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

        path:"/task/new",
        element:<KanbanCard task={{id:"1", title:"tarea uno", assignee: undefined, dueDate:"", status:"ToDo", description:""}}/>
    },
    {
        path: "/geo/2d",
        element: <GeoMapViewer />,
    },
    {
        path: "/task/new",
        element: <KanbanCard task={{ id: "1", title: "tarea 1", assignee: undefined, dueDate:"" ,status: 'ToDo',description: ""}} />
    }



]);
