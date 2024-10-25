import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'
import {Button} from "@nextui-org/button";
import { Providers } from "./providers";
import { AppSidebar } from './components/app-side';
import { SidebarTrigger } from './components/ui/sidebar';

function App(): JSX.Element {

  return (
    <Providers>
      <AppSidebar />
      <main>
        <SidebarTrigger />
      </main>
    </Providers>
  )
}

export default App


