import { Tailwind, Button } from '@react-email/components'

const Email = () => {
  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: '#007291',
            },
          },
        },
      }}
    >
      <Button
        href="https://example.com"
        className="bg-brand px-3 py-2 font-medium leading-4 text-white"
      >
        Click me
      </Button>
    </Tailwind>
  )
}

export default Email