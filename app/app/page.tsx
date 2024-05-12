import { Card } from '@nextui-org/card'

export default function Index() {
  return (
    <div className="h-full grid-rows-7 grid grid-cols-4 gap-8">
      <Card>1</Card>
      <Card className="col-span-2 col-start-3 row-span-2 row-start-3">4</Card>
      <Card className="col-start-2 row-start-1">5</Card>
      <Card className="col-start-4 row-start-1">6</Card>
      <Card className="col-start-3 row-start-1">7</Card>
      <Card className="col-span-2 col-start-1 row-span-3 row-start-2">8</Card>
      <Card className="col-span-2 col-start-3 row-start-2">9</Card>
      <Card className="col-span-2 col-start-3 row-span-3 row-start-5">17</Card>
      <Card className="col-span-2 col-start-1 row-span-3 row-start-5">18</Card>
    </div>
  )
}
