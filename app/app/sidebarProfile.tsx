import { Avatar } from "@nextui-org/avatar";
import { Button } from "@nextui-org/button";
import { ImExit } from "react-icons/im";
import { Popover, PopoverTrigger, PopoverContent } from "@nextui-org/popover";
import {
  MdAccountBalance,
  MdSettings,
  MdSettingsInputComponent,
  MdSupervisorAccount,
} from "react-icons/md";
import Link from "next/link";
import { motion } from "framer-motion";

const nameAnimation = {
  initial: { opacity: 1, width: "100%" },
  exit: { opacity: 0, width: "0%" },
};

export default function SidebarProfile({ mini }: { mini: boolean }) {
  // TODO: Dynamically fetch name and email from API
  // TODO: Dynamically fetch profile picture from API

  const name = "John Doe";
  const email = "John.Doe@example.com";

  return (
    <SidebarProfilePopover>
      <div className="w-full transition-transform">
        <motion.div
          layout
          className={
            "flex w-full cursor-pointer items-center px-3 py-[6px] text-left " +
            (mini ? "justify-center" : "justify-between")
          }
        >
          <Avatar className="h-[30px] w-[30px]"></Avatar>
          <motion.div
            variants={nameAnimation}
            layout
            initial={false}
            transition={{ duration: 0.5 }}
            animate={mini ? "exit" : "initial"}
            className="max-w-[110px] overflow-hidden text-ellipsis whitespace-nowrap"
          >
            <span className="font-medium">{name}</span>
            <br></br>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {email}
            </span>
          </motion.div>
          {/* <Button
        isIconOnly
        className="h-unit-xl"
        variant="light"
        aria-label="Log out"
        onClick={() => console.log("logout")}
      >
        <ImExit size={20}></ImExit>
      </Button> */}
        </motion.div>
      </div>
    </SidebarProfilePopover>
  );
}

function SidebarProfilePopover({ children }: { children: React.ReactNode }) {
  return (
    <Popover
      triggerType="menu"
      placement="right"
      offset={20}
      radius="sm"
      showArrow={true}
    >
      <PopoverTrigger>{children}</PopoverTrigger>
      <PopoverContent>
        <SidebarProfilePopoverContent2></SidebarProfilePopoverContent2>
      </PopoverContent>
    </Popover>
  );
}

function SidebarProfilePopoverContent() {
  const popoverItems = [
    {
      title: "account settings",
      Icon: MdSupervisorAccount,
      href: "/app/account-settings",
    },
    {
      title: "activity log",
      Icon: MdSettingsInputComponent,
      href: "/app/account-activity",
    },
    {
      title: "logout",
      Icon: ImExit,
      href: "/app/logout",
    },
  ];

  return (
    <div>
      <ul>
        {popoverItems.map((item, idx) => {
          const { title, href, Icon } = item;
          return (
            <li key={title}>
              <Button
                variant="light"
                as={Link}
                href={href}
                className="flex h-unit-xl w-full items-center justify-start gap-10 px-3 transition-all"
                endContent={
                  <div>
                    <Icon size={20} />
                  </div>
                }
              >
                <span>{title}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SidebarProfilePopoverContent2() {
  return <div>profile settomgs</div>;
}
