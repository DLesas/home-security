import { Outlet } from "react-router-dom"
import { AppSidebar } from "./components/app-side"
import { SidebarProvider } from "./components/ui/sidebar"

function App(): JSX.Element {

    return (
      <main className="text-foreground bg-background w-screen h-screen">
        <SidebarProvider>
            <div className="flex flex-row h-full w-full">
                <AppSidebar />
                <Outlet />
            </div>
        </SidebarProvider>
      </main>
  )
}
  
  export default App