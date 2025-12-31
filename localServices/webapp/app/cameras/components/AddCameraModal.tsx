'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@nextui-org/input'
import { Select, SelectItem } from '@nextui-org/select'
import { Slider } from '@nextui-org/slider'
import { Checkbox } from '@nextui-org/checkbox'
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
import { useCreateCameraMutation } from '@/hooks/mutations/useCameraMutations'
import { DETECTION_CLASSES, DEFAULT_CLASS_CONFIGS, type ClassConfig } from '@/app/socketData'
import toast from 'react-hot-toast'

const classConfigSchema = z.object({
  class: z.string(),
  confidence: z.number().min(0).max(1),
})

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  building: z.string().min(1, 'Building is required'),
  ipAddress: z.string().min(1, 'IP address is required'),
  port: z.coerce.number().int().min(1).max(65535, 'Port must be 1-65535'),
  protocol: z.enum(['udp', 'rtsp']),
  username: z.string().optional(),
  password: z.string().optional(),
  streamPath: z.string().optional(),
  motionDetectionEnabled: z.boolean(),
  objectDetectionEnabled: z.boolean(),
  classConfigs: z.array(classConfigSchema),
  maxStreamFps: z.coerce.number().int().min(1).max(120),
  maxRecordingFps: z.coerce.number().int().min(1).max(60),
  jpegQuality: z.coerce.number().int().min(1).max(100),
})

type FormData = z.infer<typeof formSchema>

interface AddCameraModalProps {
  isOpen: boolean
  onClose: () => void
  defaultBuildingId?: string
}

export function AddCameraModal({ isOpen, onClose, defaultBuildingId }: AddCameraModalProps) {
  const { data: buildings = [] } = useBuildingsQuery()
  const createCamera = useCreateCameraMutation()

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      building: defaultBuildingId || '',
      ipAddress: '',
      port: 554,
      protocol: 'rtsp',
      username: '',
      password: '',
      streamPath: '',
      motionDetectionEnabled: true,
      objectDetectionEnabled: false,
      classConfigs: DEFAULT_CLASS_CONFIGS,
      maxStreamFps: 30,
      maxRecordingFps: 15,
      jpegQuality: 95,
    },
  })

  const protocol = watch('protocol')
  const objectDetectionEnabled = watch('objectDetectionEnabled')
  const classConfigs = watch('classConfigs')

  const toggleClass = (className: string) => {
    const current = classConfigs || []
    const exists = current.find((c) => c.class === className)
    if (exists) {
      setValue('classConfigs', current.filter((c) => c.class !== className))
    } else {
      setValue('classConfigs', [...current, { class: className, confidence: 0.5 }])
    }
  }

  const updateConfidence = (className: string, confidence: number) => {
    const current = classConfigs || []
    setValue('classConfigs', current.map((c) =>
      c.class === className ? { ...c, confidence } : c
    ))
  }

  const isClassEnabled = (className: string) => {
    return classConfigs?.some((c) => c.class === className) ?? false
  }

  const getClassConfidence = (className: string) => {
    return classConfigs?.find((c) => c.class === className)?.confidence ?? 0.5
  }

  const onSubmit = async (data: FormData) => {
    try {
      await createCamera.mutateAsync({
        name: data.name,
        building: data.building,
        ipAddress: data.ipAddress,
        port: data.port,
        protocol: data.protocol,
        username: data.username || undefined,
        password: data.password || undefined,
        streamPath: data.streamPath || undefined,
        motionDetectionEnabled: data.motionDetectionEnabled,
        objectDetectionEnabled: data.objectDetectionEnabled,
        classConfigs: data.classConfigs as ClassConfig[],
        maxStreamFps: data.maxStreamFps,
        maxRecordingFps: data.maxRecordingFps,
        jpegQuality: data.jpegQuality,
      })
      toast.success(`Camera "${data.name}" created`)
      reset()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create camera')
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      placement="bottom"
      scrollBehavior="inside"
      classNames={{ base: 'max-h-[90vh] sm:max-h-[80vh]' }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Add Camera</ModalHeader>
          <ModalBody className="gap-6">
            {/* Basic Info */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-default-700">Basic Info</h3>

              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Name"
                    placeholder="Front Door Camera"
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
                    isInvalid={!!errors.building}
                    errorMessage={errors.building?.message}
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

            {/* Connection */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-default-700">Connection</h3>

              <Controller
                name="protocol"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Protocol"
                    selectedKeys={field.value ? [field.value] : []}
                    onSelectionChange={(keys) => field.onChange(Array.from(keys)[0] || 'rtsp')}
                  >
                    <SelectItem key="rtsp" description="Standard IP camera protocol">
                      RTSP
                    </SelectItem>
                    <SelectItem key="udp" description="Direct UDP stream">
                      UDP
                    </SelectItem>
                  </Select>
                )}
              />

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Controller
                    name="ipAddress"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        label="IP Address"
                        placeholder="192.168.1.100"
                        isInvalid={!!errors.ipAddress}
                        errorMessage={errors.ipAddress?.message}
                      />
                    )}
                  />
                </div>
                <Controller
                  name="port"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value?.toString()}
                      onChange={(e) => field.onChange(e.target.value)}
                      label="Port"
                      type="number"
                      isInvalid={!!errors.port}
                      errorMessage={errors.port?.message}
                    />
                  )}
                />
              </div>

              {protocol === 'rtsp' && (
                <>
                  <Controller
                    name="streamPath"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        label="Stream Path"
                        placeholder="/live/ch0"
                        description="RTSP stream path (optional)"
                      />
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Controller
                      name="username"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          label="Username"
                          placeholder="admin"
                        />
                      )}
                    />
                    <Controller
                      name="password"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          label="Password"
                          type="password"
                          placeholder="password"
                        />
                      )}
                    />
                  </div>
                </>
              )}
            </section>

            {/* Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-default-700">Settings</h3>

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

              <Controller
                name="objectDetectionEnabled"
                control={control}
                render={({ field }) => (
                  <Toggle
                    isSelected={field.value}
                    onChange={field.onChange}
                    label="Enable Object Detection"
                  />
                )}
              />

              {/* Object Detection Classes */}
              {objectDetectionEnabled && (
                <div className="space-y-3 p-3 bg-default-50 rounded-lg border border-default-200">
                  <p className="text-xs text-default-500">Select objects to detect and set confidence thresholds:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DETECTION_CLASSES.map((className) => {
                      const enabled = isClassEnabled(className)
                      return (
                        <div
                          key={className}
                          className={`p-2 rounded-md border transition-colors ${
                            enabled
                              ? 'border-primary bg-primary/5'
                              : 'border-default-200 bg-default-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Checkbox
                              isSelected={enabled}
                              onValueChange={() => toggleClass(className)}
                              size="sm"
                            >
                              <span className="text-sm capitalize">{className}</span>
                            </Checkbox>
                          </div>
                          {enabled && (
                            <div className="mt-2 px-1">
                              <Slider
                                size="sm"
                                step={0.05}
                                minValue={0.1}
                                maxValue={1}
                                value={getClassConfidence(className)}
                                onChange={(val) => updateConfidence(className, val as number)}
                                className="max-w-full"
                                aria-label={`${className} confidence`}
                              />
                              <div className="flex justify-between text-xs text-default-400 mt-0.5">
                                <span>10%</span>
                                <span className="text-primary font-medium">
                                  {Math.round(getClassConfidence(className) * 100)}%
                                </span>
                                <span>100%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Controller
                  name="maxStreamFps"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value?.toString()}
                      onChange={(e) => field.onChange(e.target.value)}
                      label="Stream FPS"
                      description="1-120"
                      type="number"
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
                      description="1-60"
                      type="number"
                    />
                  )}
                />
                <Controller
                  name="jpegQuality"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value?.toString()}
                      onChange={(e) => field.onChange(e.target.value)}
                      label="JPEG Quality"
                      description="1-100"
                      type="number"
                    />
                  )}
                />
              </div>
            </section>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              type="submit"
              isLoading={createCamera.isPending}
            >
              Add Camera
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
