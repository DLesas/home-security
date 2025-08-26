import { useState, useEffect } from 'react'

interface SensorOrder {
  [building: string]: string[]
}

export const useSensorOrder = () => {
  const [sensorOrder, setSensorOrder] = useState<SensorOrder>({})
  const [hasChanges, setHasChanges] = useState(false)

  // Load sensor order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem('sensorOrder')
    if (savedOrder) {
      try {
        setSensorOrder(JSON.parse(savedOrder))
      } catch (error) {
        console.error('Failed to parse sensor order from localStorage:', error)
      }
    }
  }, [])

  const saveSensorOrder = (newOrder: SensorOrder) => {
    try {
      localStorage.setItem('sensorOrder', JSON.stringify(newOrder))
      setSensorOrder(newOrder)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save sensor order to localStorage:', error)
    }
  }

  const updateSensorOrder = (newOrder: SensorOrder) => {
    setSensorOrder(newOrder)
    setHasChanges(true)
  }

  const getSensorOrder = (building: string): string[] => {
    return sensorOrder[building] || []
  }

  const syncSensorOrder = (
    sensors: Array<{ name: string; building: string }>
  ) => {
    // Create current sensor mapping by building
    const currentSensorsByBuilding: SensorOrder = {}
    sensors.forEach((sensor) => {
      if (!currentSensorsByBuilding[sensor.building]) {
        currentSensorsByBuilding[sensor.building] = []
      }
      currentSensorsByBuilding[sensor.building].push(sensor.name)
    })

    // Get existing order or create empty object
    const existingOrder = { ...sensorOrder }
    let needsUpdate = false

    // Process each building
    const newOrder: SensorOrder = {}
    Object.keys(currentSensorsByBuilding).forEach((building) => {
      const currentSensors = currentSensorsByBuilding[building]
      const existingSensors = existingOrder[building] || []

      // Start with existing order, filtering out sensors that no longer exist
      const validExistingSensors = existingSensors.filter((sensorName) =>
        currentSensors.includes(sensorName)
      )

      // Add any new sensors that aren't in the existing order
      const newSensors = currentSensors.filter(
        (sensorName) => !existingSensors.includes(sensorName)
      )

      // Combine: existing valid sensors + new sensors in their original order
      newOrder[building] = [...validExistingSensors, ...newSensors]

      // Check if this building's order changed
      if (
        !existingOrder[building] ||
        JSON.stringify(newOrder[building]) !==
          JSON.stringify(existingOrder[building])
      ) {
        needsUpdate = true
      }
    })

    // Remove buildings that no longer have sensors
    Object.keys(existingOrder).forEach((building) => {
      if (!currentSensorsByBuilding[building]) {
        needsUpdate = true
      }
    })

    // Update if changes detected
    if (needsUpdate) {
      setSensorOrder(newOrder)
      // Auto-save the updated order
      try {
        localStorage.setItem('sensorOrder', JSON.stringify(newOrder))
      } catch (error) {
        console.error('Failed to save updated sensor order:', error)
      }
    }

    return newOrder
  }

  const initializeSensorOrder = (
    sensors: Array<{ name: string; building: string }>
  ) => {
    const defaultOrder: SensorOrder = {}
    sensors.forEach((sensor) => {
      if (!defaultOrder[sensor.building]) {
        defaultOrder[sensor.building] = []
      }
      if (!defaultOrder[sensor.building].includes(sensor.name)) {
        defaultOrder[sensor.building].push(sensor.name)
      }
    })
    setSensorOrder(defaultOrder)
    setHasChanges(true)
    return defaultOrder
  }

  return {
    sensorOrder,
    hasChanges,
    saveSensorOrder,
    updateSensorOrder,
    getSensorOrder,
    syncSensorOrder,
    initializeSensorOrder,
  }
}
