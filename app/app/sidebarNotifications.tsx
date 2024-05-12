import { Button } from "@nextui-org/button";
import { MdClose } from "react-icons/md";
import { Link } from "@nextui-org/link";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { exit } from "process";

interface sidebarNotificationProps {
  title: string;
  description: string;
  severity: "warning" | "danger";
  preset?: "space" | "time" | "users";
  goto: string;
}

function SidebarNotification({
  title,
  description,
  severity,
  preset,
  goto,
}: sidebarNotificationProps) {
  return (
    <div
      className={
        "h-40 rounded-lg p-3 " +
        (severity === "danger"
          ? "bg-danger-200 dark:bg-danger-100"
          : "bg-warning-200 dark:bg-warning-100")
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-row justify-between text-center align-middle">
          <div className="flex flex-col justify-center align-middle">
            <span className="font-medium">{title}</span>
          </div>
          <Button
            isIconOnly
            variant="light"
            className="h-[24px]"
            aria-label="Close message"
            onClick={() => console.log("message close")}
          >
            <MdClose size={20}></MdClose>
          </Button>
        </div>
        <div className="text-sm">{description}</div>
        <Button
          className="text-sm font-medium"
          as={Link}
          showAnchorIcon
          radius="sm"
          size="sm"
          variant="shadow"
          color={severity}
        >
          Upgrade plan
        </Button>
      </div>
    </div>
  );
}

function SidebarNotificationsGrid({
  issues,
}: {
  issues: sidebarNotificationProps[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {issues.map((issue, idx) => {
        return (
          <div
            key={idx}
            className={
              "flex h-5 w-5 my-8 "  +
              (issue.severity === "danger"
                ? "bg-danger-200 dark:bg-danger-100"
                : "bg-warning-200 dark:bg-warning-100")
            }
          ></div>
        );
      })}
    </div>
  );
}

function SidebarNotificationsCaroussel({
  issues,
}: {
  issues: sidebarNotificationProps[];
}) {
  return (
    <>
      {issues.map((issue, idx) => {
        return <SidebarNotification key={idx} {...issue}></SidebarNotification>;
      })}
    </>
  );
}

export default function SidebarNotifications({ mini }: { mini: boolean }) {
  //TODO: check on initial load if there are any notifications to show
  //TODO: make a carousel like component to show multiple notifications
  //TODO: make notifications dismissable
  //TODO: make notifications resizeable
  const framerIcon = {
    initial: { opacity: 0, scale: 0 },
    exit: { opacity: 0, scale: 0.2, x: -50, y: 30 },
  };

  const issues: sidebarNotificationProps[] = [
    {
      title: "Used space",
      description: "You have used up 80% of your available space. Need more?",
      severity: "warning",
      preset: "space",
      goto: "/settings",
    },
    // {
    //   title: "only 2 seats left",
    //   description: "Your team has used 8 of 10 available seats. Need more?",
    //   severity: "danger",
    //   preset: "users",
    //   goto: "/settings",
    // },
  ];

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {mini ? (
        <motion.div
          key="Grid"
          {...{
            initial: { opacity: 0, scale: 0 },
            exit: { opacity: 0, x: 70, scale: 2 },
          }}
          animate={{
            opacity: 1,
            scale: 1,
            transition: {
              type: "tween",
              duration: 0.5,
              delay: 0.2,
            },
          }}
        >
          <SidebarNotificationsGrid issues={issues}></SidebarNotificationsGrid>
        </motion.div>
      ) : (
        <motion.div
          key="carousel"
          {...framerIcon}
          animate={{
            opacity: 1,
            scale: 1,
            transition: {
              type: "spring",
              duration: 0.6,
              delay: 0.2,
            },
          }}
        >
          <SidebarNotificationsCaroussel
            issues={issues}
          ></SidebarNotificationsCaroussel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* // <SidebarNotification
    //   title="running low on memory"
    //   description="Your team has used 80% of your available space. Need more?"
    //   severity="warning"
    //   preset="space"
    //   goto="/settings"
    // ></SidebarNotification> */
