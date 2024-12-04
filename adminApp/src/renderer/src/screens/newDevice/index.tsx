import { Button } from '@nextui-org/button'
import { Card, CardBody } from "@nextui-org/card"
import { useState } from 'react'
import DevicePicker from './devicePicker'
import WifiPicker from './wifiPicker'
import ConfigSection from './ConfigSection'

export default function NewDevice() {
    const [device, setDevice] = useState<"camera" | "door_sensor" | "alarm_relay">("camera")
    const [usb, setUsb] = useState<string>("")
    const [wifi, setWifi] = useState<string>("")
    const [wifipassword, setWifiPassword] = useState<string>("")
    const [step, setStep] = useState<"initial" | "picker" | "wifi" | "config">("initial")

    const renderStep = () => {
        switch (step) {
            case "initial":
                return <InitialSetup setDevice={(device) => {
                    setDevice(device);
                    setStep("picker");
                }} />;
            case "picker":
                return <DevicePicker device={device} setUsb={(usb) => {
                    setUsb(usb);
                    setStep("wifi");
                }} />;
            case 'wifi':
                return <WifiPicker
                    device={device}
                    setWifi={(wifi, wifipassword) => {
                        setWifi(wifi)
                        setWifiPassword(wifipassword)
                        setStep('config')
                }} />;
            case "config":
                return <ConfigSection wifi={wifi} usb={usb} wifipassword={wifipassword} defaultDeviceType={device} />
            default:
                return <InitialSetup setDevice={setDevice} />;
        }
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-background to-default-100">
            {/* Progress indicator */}
            <div className="w-full px-8 py-6 bg-background/60 backdrop-blur-md border-b border-default-200">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center">
                        {["Device Type", "USB Connection", "WiFi Setup", "Configuration"].map((label, index) => (
                            <div key={label} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2
                                        ${index <= ["initial", "picker", "wifi", "config"].indexOf(step) 
                                        ? "bg-primary text-white" 
                                        : "bg-default-200 text-default-500"}`}>
                                        {index + 1}
                                    </div>
                                    <span className="text-sm text-default-600 hidden md:block">{label}</span>
                                </div>
                                {index < 3 && (
                                    <div className={`h-[2px] w-full mx-2 mt-[-20px]
                                        ${index < ["initial", "picker", "wifi", "config"].indexOf(step) 
                                        ? "bg-primary" 
                                        : "bg-default-200"}`} 
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-auto p-8">
                <Card className="max-w-4xl mx-auto h-full bg-background/60 backdrop-blur-md border-none shadow-lg">
                    <CardBody>
                        {renderStep()}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}

function InitialSetup({setDevice}: {setDevice: (device: "camera" | "door_sensor" | "alarm_relay") => void}) {
    const deviceTypes = [
        { type: "camera", label: "Camera", icon: "📷", description: "Add a new security camera to your system" },
        { type: "door_sensor", label: "Door Sensor", icon: "🚪", description: "Monitor entry points with a door sensor" },
        { type: "alarm_relay", label: "Alarm Relay", icon: "🚨", description: "Control alarm systems and notifications" },
    ] as const;

    return (
        <div className='w-full h-full flex flex-col items-center justify-center gap-8 p-6'>
            <div className='text-center space-y-3 mb-4'>
                <h1 className='text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent'>
                    Add New Device
                </h1>
                <p className='text-default-500 text-lg'>
                    Select the type of device you want to configure
                </p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl'>
                {deviceTypes.map(({ type, label, icon, description }) => (
                    <Button
                        key={type}
                        onClick={() => setDevice(type)}
                        className="h-40 bg-content1 hover:bg-content2 transition-all group"
                        variant="flat"
                    >
                        <div className="flex flex-col items-center gap-3 p-4">
                            <span className="text-4xl group-hover:scale-110 transition-transform">
                                {icon}
                            </span>
                            <div className="text-center">
                                <p className="font-semibold text-lg">{label}</p>
                                <p className="text-sm text-default-500 mt-1">
                                    {description}
                                </p>
                            </div>
                        </div>
                    </Button>
                ))}
            </div>
        </div>
    )
}




