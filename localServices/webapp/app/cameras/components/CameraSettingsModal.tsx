'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@nextui-org/input'
import { Select, SelectItem } from '@nextui-org/select'
import { Toggle } from '@/components/Toggle'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@nextui-org/modal'
import { Button } from '@nextui-org/button'
import { useBuildingsQuery } from '@/hooks/useBuildingsQuery'
import { useUpdateCameraMutation } from '@/hooks/mutations/useCameraMutations'
import {
  type Camera,
  type DetectionModel,
  type SimpleDiffSettings,
  type KNNSettings,
  type MOG2Settings,
} from '../../socketData'
import toast from 'react-hot-toast'

// Zod schemas for form validation
const simpleDiffSettingsSchema = z.object({
  threshold: z.coerce.number().int().min(0).max(255),
})

const knnSettingsSchema = z.object({
  history: z.coerce.number().int().min(1),
  dist2Threshold: z.coerce.number().min(0),
  detectShadows: z.boolean(),
})

const mog2SettingsSchema = z.object({
  history: z.coerce.number().int().min(1),
  varThreshold: z.coerce.number().min(0),
  detectShadows: z.boolean(),
})

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  building: z.string().optional(),
  targetWidth: z.coerce.number().int().min(1).optional().or(z.literal('')),
  targetHeight: z.coerce.number().int().min(1).optional().or(z.literal('')),
  motionDetectionEnabled: z.boolean(),
  detectionModel: z.enum(['simple_diff', 'knn', 'mog2']),
  // Model-specific settings (we validate the active one in handleSubmit)
  simpleDiff: simpleDiffSettingsSchema,
  knn: knnSettingsSchema,
  mog2: mog2SettingsSchema,
  maxStreamFps: z.coerce.number().int().min(1).max(120),
  maxRecordingFps: z.coerce.number().int().min(1).max(60),
  jpegQuality: z.coerce.number().int().min(1).max(100),
})

type FormData = z.infer<typeof formSchema>

interface CameraSettingsModalProps {
  camera: Camera
  isOpen: boolean
  onClose: () => void
}

// Helper to extract model settings from camera
function getModelSettings(camera: Camera) {
  const settings = camera.modelSettings

  // Defaults for each model type
  const defaults = {
    simpleDiff: { threshold: 25 },
    knn: { history: 500, dist2Threshold: 400, detectShadows: false },
    mog2: { history: 500, varThreshold: 16, detectShadows: false },
  }

  // Override defaults with current camera settings
  if (camera.detectionModel === 'simple_diff' && 'threshold' in settings) {
    defaults.simpleDiff = settings as SimpleDiffSettings
  } else if (camera.detectionModel === 'knn' && 'dist2Threshold' in settings) {
    defaults.knn = settings as KNNSettings
  } else if (camera.detectionModel === 'mog2' && 'varThreshold' in settings) {
    defaults.mog2 = settings as MOG2Settings
  }

  return defaults
}

export function CameraSettingsModal({ camera, isOpen, onClose }: CameraSettingsModalProps) {
  const { data: buildings = [] } = useBuildingsQuery()
  const updateCamera = useUpdateCameraMutation()

  const modelSettings = getModelSettings(camera)
  const currentBuilding = buildings.find(b => b.name === camera.building)

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: camera.name,
      building: currentBuilding?.id || '',
      targetWidth: '',
      targetHeight: '',
      motionDetectionEnabled: camera.motionDetectionEnabled,
      detectionModel: camera.detectionModel,
      simpleDiff: modelSettings.simpleDiff,
      knn: modelSettings.knn,
      mog2: modelSettings.mog2,
      maxStreamFps: camera.maxStreamFps ?? 30,
      maxRecordingFps: camera.maxRecordingFps ?? 15,
      jpegQuality: camera.jpegQuality,
    },
  })

  // Reset form when camera changes or modal opens
  useEffect(() => {
    if (isOpen && camera) {
      const settings = getModelSettings(camera)
      const building = buildings.find(b => b.name === camera.building)

      reset({
        name: camera.name,
        building: building?.id || '',
        targetWidth: '',
        targetHeight: '',
        motionDetectionEnabled: camera.motionDetectionEnabled,
        detectionModel: camera.detectionModel,
        simpleDiff: settings.simpleDiff,
        knn: settings.knn,
        mog2: settings.mog2,
        maxStreamFps: camera.maxStreamFps ?? 30,
        maxRecordingFps: camera.maxRecordingFps ?? 15,
        jpegQuality: camera.jpegQuality,
      })
    }
  }, [camera, isOpen, buildings, reset])

  const detectionModel = watch('detectionModel')
  const motionDetectionEnabled = watch('motionDetectionEnabled')

  const onSubmit = async (data: FormData) => {
    const updates: Record<string, unknown> = {}

    // Basic fields
    if (data.name !== camera.name) updates.name = data.name

    const currentBuildingId = buildings.find(b => b.name === camera.building)?.id
    if (data.building && data.building !== currentBuildingId) {
      updates.building = data.building
    }

    if (data.targetWidth && typeof data.targetWidth === 'number') {
      updates.targetWidth = data.targetWidth
    }
    if (data.targetHeight && typeof data.targetHeight === 'number') {
      updates.targetHeight = data.targetHeight
    }

    if (data.motionDetectionEnabled !== camera.motionDetectionEnabled) {
      updates.motionDetectionEnabled = data.motionDetectionEnabled
    }

    // Detection model and settings
    if (data.detectionModel !== camera.detectionModel) {
      updates.detectionModel = data.detectionModel
    }

    // Map detection model to form key
    const modelToFormKey = {
      simple_diff: 'simpleDiff',
      knn: 'knn',
      mog2: 'mog2',
    } as const
    const formKey = modelToFormKey[data.detectionModel]

    // Get the active model settings
    const newModelSettings = data[formKey]
    const oldModelSettings = camera.modelSettings

    // Check if model settings changed
    const modelChanged = data.detectionModel !== camera.detectionModel
    const settingsChanged = JSON.stringify(newModelSettings) !== JSON.stringify(oldModelSettings)

    if (modelChanged || settingsChanged) {
      updates.modelSettings = newModelSettings
      if (!updates.detectionModel) {
        updates.detectionModel = data.detectionModel
      }
    }

    // FPS and quality
    if (data.maxStreamFps !== (camera.maxStreamFps ?? 30)) {
      updates.maxStreamFps = data.maxStreamFps
    }
    if (data.maxRecordingFps !== (camera.maxRecordingFps ?? 15)) {
      updates.maxRecordingFps = data.maxRecordingFps
    }
    if (data.jpegQuality !== camera.jpegQuality) {
      updates.jpegQuality = data.jpegQuality
    }

    // Skip if nothing changed
    if (Object.keys(updates).length === 0) {
      onClose()
      return
    }

    try {
      await updateCamera.mutateAsync({
        cameraId: camera.externalID,
        updates,
      })
      toast.success('Camera settings updated')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update camera')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="bottom"
      scrollBehavior="inside"
      classNames={{ base: 'max-h-[90vh] sm:max-h-[80vh]' }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Camera Settings</ModalHeader>
          <ModalBody className="gap-6">
            {/* Basic Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-default-700">Basic</h3>

              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Name"
                    placeholder="Camera name"
                    isInvalid={!!errors.name}
                    errorMessage={errors.name?.message}
                  />
                )}
              />

              <Controller
                name="building"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Building"
                    placeholder="Select building"
                    selectedKeys={field.value ? [field.value] : []}
                    onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] || '')}
                  >
                    {buildings.map((building) => (
                      <SelectItem key={building.id}>
                        {building.name || 'Unnamed'}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
            </section>

            {/* Resolution Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-default-700">Resolution (optional)</h3>
              <p className="text-xs text-default-500">Leave empty to use native stream resolution</p>

              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="targetWidth"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value?.toString() || ''}
                      label="Width"
                      placeholder="e.g. 1280"
                      type="number"
                    />
                  )}
                />
                <Controller
                  name="targetHeight"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value?.toString() || ''}
                      label="Height"
                      placeholder="e.g. 720"
                      type="number"
                    />
                  )}
                />
              </div>
            </section>

            {/* Frame Rate Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-default-700">Frame Rate Caps</h3>
              <p className="text-xs text-default-500">Maximum FPS (actual = min of detected and cap)</p>

              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="maxStreamFps"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value?.toString()}
                      onChange={(e) => field.onChange(e.target.value)}
                      label="Stream FPS"
                      description="Live streaming (1-120)"
                      type="number"
                      min={1}
                      max={120}
                    />
                  )}
                />
                <Controller
                  name="maxRecordingFps"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value?.toString()}
                      onChange={(e) => field.onChange(e.target.value)}
                      label="Recording FPS"
                      description="HLS recording (1-60)"
                      type="number"
                      min={1}
                      max={60}
                    />
                  )}
                />
              </div>
            </section>

            {/* Encoding Quality */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-default-700">Encoding Quality</h3>

              <Controller
                name="jpegQuality"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value?.toString()}
                    onChange={(e) => field.onChange(e.target.value)}
                    label="JPEG Quality"
                    description="1-100 (higher = better quality, larger files)"
                    type="number"
                    min={1}
                    max={100}
                  />
                )}
              />
            </section>

            {/* Motion Detection Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-default-700">Motion Detection</h3>

              <Controller
                name="motionDetectionEnabled"
                control={control}
                render={({ field }) => (
                  <Toggle
                    isSelected={field.value}
                    onChange={field.onChange}
                    label="Enable Motion Detection"
                  />
                )}
              />

              {motionDetectionEnabled && (
                <div className="space-y-4 pl-3 border-l-2 border-default-200">
                  {/* Detection Model Selector */}
                  <Controller
                    name="detectionModel"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Detection Model"
                        description="Algorithm used for motion detection"
                        selectedKeys={field.value ? [field.value] : []}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as DetectionModel
                          field.onChange(selected || 'mog2')
                        }}
                      >
                        <SelectItem key="mog2" description="Adaptive background, good for static cameras">
                          MOG2 (Background Subtraction)
                        </SelectItem>
                        <SelectItem key="knn" description="Better at handling shadows">
                          KNN (K-Nearest Neighbors)
                        </SelectItem>
                        <SelectItem key="simple_diff" description="Fast, compares consecutive frames">
                          Simple Frame Difference
                        </SelectItem>
                      </Select>
                    )}
                  />

                  {/* SimpleDiff Settings */}
                  {detectionModel === 'simple_diff' && (
                    <Controller
                      name="simpleDiff.threshold"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          value={field.value?.toString()}
                          onChange={(e) => field.onChange(e.target.value)}
                          label="Threshold"
                          description="Pixel difference threshold (0-255)"
                          type="number"
                          min={0}
                          max={255}
                        />
                      )}
                    />
                  )}

                  {/* KNN Settings */}
                  {detectionModel === 'knn' && (
                    <>
                      <Controller
                        name="knn.history"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value?.toString()}
                            onChange={(e) => field.onChange(e.target.value)}
                            label="History"
                            description="Frames for background model"
                            type="number"
                            min={1}
                          />
                        )}
                      />
                      <Controller
                        name="knn.dist2Threshold"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value?.toString()}
                            onChange={(e) => field.onChange(e.target.value)}
                            label="Distance Threshold"
                            description="Threshold for sample matching"
                            type="number"
                            min={0}
                          />
                        )}
                      />
                      <Controller
                        name="knn.detectShadows"
                        control={control}
                        render={({ field }) => (
                          <Toggle
                            isSelected={field.value}
                            onChange={field.onChange}
                            label="Detect Shadows"
                          />
                        )}
                      />
                    </>
                  )}

                  {/* MOG2 Settings */}
                  {detectionModel === 'mog2' && (
                    <>
                      <Controller
                        name="mog2.history"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value?.toString()}
                            onChange={(e) => field.onChange(e.target.value)}
                            label="History"
                            description="Frames for background model"
                            type="number"
                            min={1}
                          />
                        )}
                      />
                      <Controller
                        name="mog2.varThreshold"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value?.toString()}
                            onChange={(e) => field.onChange(e.target.value)}
                            label="Variance Threshold"
                            description="Threshold for foreground detection"
                            type="number"
                            min={0}
                          />
                        )}
                      />
                      <Controller
                        name="mog2.detectShadows"
                        control={control}
                        render={({ field }) => (
                          <Toggle
                            isSelected={field.value}
                            onChange={field.onChange}
                            label="Detect Shadows"
                          />
                        )}
                      />
                    </>
                  )}
                </div>
              )}
            </section>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              type="submit"
              isLoading={updateCamera.isPending}
            >
              Save
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
