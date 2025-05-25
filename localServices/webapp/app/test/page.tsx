"use client"

import React, { useEffect, useState } from 'react';
import { useSocket } from '../socketInitializer'
import { Button } from '@nextui-org/button';
import { Input } from '@nextui-org/input';

// Building
// router.post("/new", async (req, res) => {
// 	const validationSchema = z.object({
// 		name: z
// 			.string({
// 				required_error: "name is required",
// 				invalid_type_error: "name must be a string",
// 			})
// 			.min(1, "name must be at least 1 character")
// 			.max(255, "name must be less than 255 characters"),
// 	});


// Sensor
// router.post("/new", async (req, res) => {
// 	const validationSchema = z.object({
// 		name: z
// 			.string({
// 				required_error: "name is required",
// 				invalid_type_error: "name must be a string",
// 			})
// 			.min(1, "name must be at least 1 character")
// 			.max(255, "name must be less than 255 characters"),
// 		building: z
// 			.string({
// 				required_error: "building is required",
// 				invalid_type_error: "building must be a string",
// 			})
// 			.min(1, "building must be at least 1 character")
// 			.max(255, "building must be less than 255 characters"),
// 		expectedSecondsUpdated: z
// 			.number({
// 				required_error: "expectedSecondsUpdated is required",
//                 invalid_type_error: "expectedSecondsUpdated must be a number",
//             })
//             .min(0, "expectedSecondsUpdated must be more than 0 seconds")
//             .max(3600 * 24, "expectedSecondsUpdated must be less than 24 hours"),
// 	});


const StorageListenerComponent: React.FC = () => {
 const [showNewSensor, setShowNewSensor] = useState(false)
 const [showNewBuilding, setShowNewBuilding] = useState(false)


  return (
    <div className='flex flex-col gap-4'>
      <button onClick={() => setShowNewSensor(!showNewSensor)}>new sensor</button>
      <button onClick={() => setShowNewBuilding(!showNewBuilding)}>new building</button>
      {showNewSensor && <NewSensorComponent />}
      {showNewBuilding && <NewBuildingComponent />}
    </div>
  );
};

const NewSensorComponent: React.FC = () => {
  const {url} = useSocket()
  const [sensorName, setSensorName] = useState('')
  const [buildingName, setBuildingName] = useState('')
  const [expectedSecondsUpdated, setExpectedSecondsUpdated] = useState<number>(0)

  const makeNewSensor = () => {
    fetch(`${url}/api/v1/sensors/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this line
      },
      body: JSON.stringify({name: sensorName, building: buildingName, expectedSecondsUpdated: expectedSecondsUpdated}),
    })
    .then((res) => res.json())
    .then((data) => {
      console.log(data)
    })
  }

  return (
    <div>
      {sensorName}
      <Input label="Sensor Name" onChange={(e) => setSensorName(e.target.value)} />
      {buildingName}
      <Input label="Building Name" onChange={(e) => setBuildingName(e.target.value)} />
      {expectedSecondsUpdated}
      <Input label="Expected Seconds Updated" type="number" onChange={(e) => setExpectedSecondsUpdated(parseInt(e.target.value))} />
      <Button onClick={makeNewSensor}>Create</Button>
    </div>
  );
};


const NewBuildingComponent: React.FC = () => {
  const {url} = useSocket()
  const [buildingName, setBuildingName] = useState('')

  const makeNewBuilding = () => {
    fetch(`${url}/api/v1/buildings/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this line
      },
      body: JSON.stringify({name: buildingName}),
    })
    .then((res) => res.json())
    .then((data) => {
      console.log(data)
    })
  }

  return (
    <div>
      {buildingName}
      <Input label="Building Name" onChange={(e) => setBuildingName(e.target.value)} />
      <Button onClick={makeNewBuilding}>Create</Button>
    </div>
  );
};

export default StorageListenerComponent;
