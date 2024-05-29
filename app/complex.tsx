import { Card, CardHeader, CardBody, CardFooter } from '@nextui-org/card'
import { Divider } from '@nextui-org/divider'
import { cn } from '@/lib/utils'
import humanizeDuration from 'humanize-duration'

function SensorCard({
    name,
    door_state,
    temperature,
    time,
  }: {
    name: string
    door_state: string
    temperature: number
    time: string
  }) {
    const date = new Date(time)
    date.setHours(date.getHours())
    return (
      <Card
        className={`${door_state === 'open' ? 'bg-red-500' : ''}  col-span-4`}
      >
        <CardHeader className="flex gap-3">
          <div className="flex flex-col">
            <p className="text-md">{name}</p>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <p> {door_state} </p>
        </CardBody>
        <Divider />
        <CardFooter>
          <p> {temperature} </p>
        </CardFooter>
        <div>
          {
            // @ts-ignore
            humanizeDuration(new Date() - date, {
              units: ['s', 'ms'],
              round: true,
            })
          }
        </div>
        <div>{new Date().toLocaleTimeString()}</div>
        <div>{date.toLocaleTimeString()}</div>
      </Card>
    )
  }