import { Bonjour, type Service, type Bonjour as BonjourType } from "bonjour-service";

/** The name of the Bonjour service to publish */
const SERVICE_NAME = process.env.BROADCASTING_NAME || "DefaultService";

/** The port number for the Bonjour service */
const PORT = process.env.SERVER_PORT ? Number(process.env.SERVER_PORT) : 3000;

/** The interval (in milliseconds) between service checks */
const CHECK_INTERVAL_MS = process.env.BROADCASTING_INTERVAL ? Number(process.env.BROADCASTING_INTERVAL) : 60000;

/**
 * Starts a Bonjour service and sets up a regular check interval.
 * 
 * This function initializes a new Bonjour instance, publishes a service with the specified
 * name and port, and sets up a periodic check to ensure the service remains active.
 * 
 * @returns {() => void} A cleanup function that stops the service check and unpublishes the Bonjour service when called.
 */
export function startBonjourService(): () => void {
  let bonjourInstance: BonjourType;
  let bonjourService: Service;
  let checkInterval: NodeJS.Timeout;

  /**
   * Initializes and publishes the Bonjour service.
   */
  function initializeService() {
    bonjourInstance = new Bonjour();
    bonjourService = bonjourInstance.publish({
      name: SERVICE_NAME,
      type: 'http',
      port: PORT,
      host: '0.0.0.0'
    });

    console.log('Bonjour service published');
  }

  /**
   * Checks the status of the Bonjour service and restarts it if not running.
   */
  function checkBonjourService() {
    if (!bonjourService || !bonjourService.published) {
      console.log('Bonjour service not running, restarting...');
      if (bonjourInstance) {
        bonjourInstance.unpublishAll();
        bonjourInstance.destroy();
      }
      initializeService();
    }
  }

  // Initialize the service
  initializeService();

  // Set up the check interval
  checkInterval = setInterval(checkBonjourService, CHECK_INTERVAL_MS);

  /**
   * Cleanup function that stops the service check and unpublishes the Bonjour service.
   */
  return () => {
    clearInterval(checkInterval);
    if (bonjourInstance) {
      bonjourInstance.unpublishAll();
      bonjourInstance.destroy();
    }
    console.log('Bonjour service stopped and unpublished');
  };
}