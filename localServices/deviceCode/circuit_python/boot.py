import supervisor
import usb_cdc
import storage

# Set the USB device name and manufacturer
supervisor.set_usb_identification(manufacturer="Dimitri Lesas", product="Alarm system")