import supervisor
import usb_cdc

# Set the USB device name and manufacturer
supervisor.set_usb_identification(manufacturer="Dimitri Lesas", product="Alarm system")