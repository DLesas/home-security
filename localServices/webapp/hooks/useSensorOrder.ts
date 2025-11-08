import { useState, useEffect } from 'react'

interface SensorOrder {
  buildingOrder: string[]
  sensorsInBuildings: { [building: string]: string[] }
}

export const useSensorOrder = () => {
  const [sensorOrder, setSensorOrder] = useState<SensorOrder>({
    buildingOrder: [],
    sensorsInBuildings: {},
  })
  const [hasChanges, setHasChanges] = useState(false)

  // Load sensor order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem('sensorOrder')
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder)
        // Handle backward compatibility - old format was { [building: string]: string[] }
        if (Array.isArray(parsed.buildingOrder) && parsed.sensorsInBuildings) {
          // New format
          setSensorOrder(parsed)
        } else {
          // Old format - convert to new format
          const buildingOrder = Object.keys(parsed)
          const sensorsInBuildings = parsed
          setSensorOrder({ buildingOrder, sensorsInBuildings })
          // Save in new format
          const newFormat = { buildingOrder, sensorsInBuildings }
          localStorage.setItem('sensorOrder', JSON.stringify(newFormat))
        }
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

      // Dispatch custom event to notify other components of the change
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sensorOrderChanged'))
      }
    } catch (error) {
      console.error('Failed to save sensor order to localStorage:', error)
    }
  }

  const updateSensorOrder = (newOrder: SensorOrder) => {
    setSensorOrder(newOrder)
    setHasChanges(true)
  }

  const getSensorOrder = (building: string): string[] => {
    return sensorOrder.sensorsInBuildings[building] || []
  }

  const getBuildingOrder = (): string[] => {
    return sensorOrder.buildingOrder || []
  }

  const syncSensorOrder = (
    sensors: Array<{ name: string; building: string }>
  ) => {
    // Create current sensor mapping by building
    const currentSensorsByBuilding: { [building: string]: string[] } = {}
    sensors.forEach((sensor) => {
      if (!currentSensorsByBuilding[sensor.building]) {
        currentSensorsByBuilding[sensor.building] = []
      }
      currentSensorsByBuilding[sensor.building].push(sensor.name)
    })

    // Get existing order
    const existingBuildingOrder = sensorOrder.buildingOrder || []
    const existingSensorsInBuildings = sensorOrder.sensorsInBuildings || {}
    let needsUpdate = false

    // Sync building order
    const currentBuildings = Object.keys(currentSensorsByBuilding)
    const validExistingBuildings = existingBuildingOrder.filter((building) =>
      currentBuildings.includes(building)
    )
    const newBuildings = currentBuildings.filter(
      (building) => !existingBuildingOrder.includes(building)
    )
    const newBuildingOrder = [...validExistingBuildings, ...newBuildings]

    if (
      JSON.stringify(newBuildingOrder) !== JSON.stringify(existingBuildingOrder)
    ) {
      needsUpdate = true
    }

    // Process sensors in each building
    const newSensorsInBuildings: { [building: string]: string[] } = {}
    Object.keys(currentSensorsByBuilding).forEach((building) => {
      const currentSensors = currentSensorsByBuilding[building]
      const existingSensors = existingSensorsInBuildings[building] || []

      // Start with existing order, filtering out sensors that no longer exist
      const validExistingSensors = existingSensors.filter((sensorName) =>
        currentSensors.includes(sensorName)
      )

      // Add any new sensors that aren't in the existing order
      const newSensors = currentSensors.filter(
        (sensorName) => !existingSensors.includes(sensorName)
      )

      // Combine: existing valid sensors + new sensors in their original order
      newSensorsInBuildings[building] = [...validExistingSensors, ...newSensors]

      // Check if this building's sensor order changed
      if (
        !existingSensorsInBuildings[building] ||
        JSON.stringify(newSensorsInBuildings[building]) !==
          JSON.stringify(existingSensorsInBuildings[building])
      ) {
        needsUpdate = true
      }
    })

    // Remove buildings that no longer have sensors
    Object.keys(existingSensorsInBuildings).forEach((building) => {
      if (!currentSensorsByBuilding[building]) {
        needsUpdate = true
      }
    })

    // Update if changes detected
    const newOrder: SensorOrder = {
      buildingOrder: newBuildingOrder,
      sensorsInBuildings: newSensorsInBuildings,
    }

    if (needsUpdate) {
      setSensorOrder(newOrder)
      // Auto-save the updated order
      try {
        localStorage.setItem('sensorOrder', JSON.stringify(newOrder))
        // Dispatch custom event to notify other components of the change
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sensorOrderChanged'))
        }
      } catch (error) {
        console.error('Failed to save updated sensor order:', error)
      }
    }

    return newOrder
  }

  const initializeSensorOrder = (
    sensors: Array<{ name: string; building: string }>
  ) => {
    const sensorsInBuildings: { [building: string]: string[] } = {}
    const buildingOrder: string[] = []

    sensors.forEach((sensor) => {
      if (!sensorsInBuildings[sensor.building]) {
        sensorsInBuildings[sensor.building] = []
        buildingOrder.push(sensor.building)
      }
      if (!sensorsInBuildings[sensor.building].includes(sensor.name)) {
        sensorsInBuildings[sensor.building].push(sensor.name)
      }
    })

    const defaultOrder: SensorOrder = {
      buildingOrder,
      sensorsInBuildings,
    }

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
    getBuildingOrder,
    syncSensorOrder,
    initializeSensorOrder,
  }
}
