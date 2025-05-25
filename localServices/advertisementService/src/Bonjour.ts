import { Bonjour, type Service } from "bonjour-service";
import os from "os";

/** The name of the Bonjour service to publish */
const SERVICE_NAME = process.env.BONJOUR_BROADCASTING_NAME || "DefaultService";

/** The port number for the Bonjour service */
const PORT = process.env.BONJOUR_PORT ? Number(process.env.BONJOUR_PORT) : 4000;

/** The interval (in milliseconds) between service checks */
const CHECK_INTERVAL_MS = process.env.BONJOUR_BROADCASTING_INTERVAL ? Number(process.env.BONJOUR_BROADCASTING_INTERVAL) : 60000;

/**
 * Starts Bonjour services on all available network interfaces and sets up regular check intervals.
 * 
 * This function initializes a single Bonjour instance and uses it to publish services
 * on each non-internal IPv4 interface with the specified name and port. It also sets up
 * periodic checks to ensure the services remain active.
 * 
 * @returns {() => void} A cleanup function that stops all service checks and unpublishes all Bonjour services when called.
 */
export function startBonjourService(): () => void {
  const bonjourInstance = new Bonjour();
  const bonjourServices: Service[] = [];
  let checkInterval: NodeJS.Timeout;

  /**
   * Initializes and publishes Bonjour services on all available network interfaces.
   */
  function initializeServices(): void {
    const networkInterfaces = os.networkInterfaces();

    Object.values(networkInterfaces).forEach((interfaces) => {
      interfaces?.forEach((iface) => {
        if (iface.family === "IPv4" && !iface.internal) {
          const bonjourService = bonjourInstance.publish({
            name: SERVICE_NAME,
            type: 'http',
            port: PORT,
            host: iface.address
          });
          bonjourServices.push(bonjourService);
          console.log(`Bonjour service published with name ${SERVICE_NAME} on port ${PORT} for interface ${iface.address}`);
        }
      });
    });
  }

  /**
   * Checks the status of all Bonjour services and restarts them if not running.
   */
  function checkBonjourServices(): void {
    bonjourServices.forEach((service, index) => {
      if (!service || !service.published) {
        console.log(`Bonjour service not running on interface with address ${service.host}, restarting...`);
        const networkInterfaces = os.networkInterfaces();
        const iface = Object.values(networkInterfaces)
          .flat()
          .find((i): i is os.NetworkInterfaceInfo => i !== undefined && i.family === "IPv4" && !i.internal);

        if (iface) {
          const newService = bonjourInstance.publish({
            name: SERVICE_NAME,
            type: 'http',
            port: PORT,
            host: iface.address
          });
          
          bonjourServices[index] = newService;
          console.log(`Restarted Bonjour service on interface with address ${iface.address}`);
        }
      }
    });
  }

  // Initialize the services
  initializeServices();

  // Set up the check interval
  checkInterval = setInterval(checkBonjourServices, CHECK_INTERVAL_MS);

  /**
   * Cleanup function that stops all service checks and unpublishes all Bonjour services.
   */
  return () => {
    clearInterval(checkInterval);
    bonjourInstance.unpublishAll();
    bonjourInstance.destroy();
    console.log('All Bonjour services stopped and unpublished');
  };
}