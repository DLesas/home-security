// import { useEffect } from "react";
// import { createSocket } from "@/lib/socket";

// const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
//   const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
//   const base64 = (base64String + padding)
//     .replace(/\-/g, "+")
//     .replace(/_/g, "/");

//   const rawData = window.atob(base64);
//   const outputArray = new Uint8Array(rawData.length);

//   for (let i = 0; i < rawData.length; ++i) {
//     outputArray[i] = rawData.charCodeAt(i);
//   }
//   return outputArray;
// };

// const usePushNotifications = (publicVapidKey: string): void => {
//   useEffect(() => {
//     if ("serviceWorker" in navigator) {
//       navigator.serviceWorker.register("/service-worker.js")
//         .then((registration) => {
//           console.log(
//             "Service Worker registered with scope:",
//             registration.scope,
//           );
//           return registration;
//         }).then((registration) => {
//           if (Notification.permission === "default") {
//             Notification.requestPermission().then((permission) => {
//               if (permission === "granted") {
//                 subscribeUser(registration);
//               }
//             });
//           } else if (Notification.permission === "granted") {
//             subscribeUser(registration);
//           }
//         }).catch((err) => {
//           console.log("Service Worker registration failed:", err);
//         });
//     }
//   }, [publicVapidKey]);

//   const subscribeUser = async (registration: ServiceWorkerRegistration) => {
//     try {
//       const subscription = await registration.pushManager.subscribe({
//         userVisibleOnly: true,
//         applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
//       });
//       socket.timeout(5000).emit("subscribe", subscription);
//       console.log("User is subscribed:", subscription);
//     } catch (err) {
//       console.error("Failed to subscribe the user: ", err);
//     }
//   };
// };

// export default usePushNotifications;
