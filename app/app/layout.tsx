import Headernav from './header'
import SidebarParent from './sidebarParent'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex purple flex-row">
      <div className="m-0 flex min-w-[16rem] max-w-[16rem] flex-row p-0">
        <SidebarParent></SidebarParent>
      </div>
      {/* <SubSidebar></SubSidebar> */}
      <div className="flex w-full flex-col gap-5 px-20">
        <header className="w-full pt-8 pb-4">
          <Headernav></Headernav>
        </header>
        <main className="h-full pt-4 pb-12">{children}</main>
      </div>
    </div>
  )
}
