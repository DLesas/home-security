import { Outlet } from "react-router-dom"
import { AppSidebar } from "./components/app-side"

function App(): JSX.Element {

    

    return (
      <main className="text-foreground bg-background w-screen h-screen">
            <div className="flex flex-row h-full w-full">
                <AppSidebar />
                <Outlet />
            </div>
      </main>
  )
}
  
  export default App