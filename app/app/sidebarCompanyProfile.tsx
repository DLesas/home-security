import React from 'react'
import LightDark from '@/components/LightDark'
import NextImage, { StaticImageData } from 'next/image'
import { Input } from '@nextui-org/input'
import { MdSearch } from 'react-icons/md'
import { motion } from 'framer-motion'

const opacityAnimation = {
  initial: { opacity: 1 },
  exit: {
    opacity: 0,
  },
}

const nameAnimation = {
  initial: { opacity: 1, width: '100%' },
  exit: { opacity: 0, width: '0%' },
}

export default function sidebarCompanyProfile({
  companyLogo,
  mini,
}: {
  companyLogo: StaticImageData
  mini: boolean
}) {
  return (
    <>
      <motion.div
        layout
        className={
          'flex items-center  p-3 ' +
          (mini ? 'justify-center' : 'justify-between')
        }
      >
        <NextImage
          width={33}
          height={33}
          src={companyLogo}
          alt="Company Logo"
        />
        <motion.span
          variants={nameAnimation}
          layout
          transition={{ duration: 0.3 }}
          animate={mini ? 'exit' : 'initial'}
          className="max-w-[105px] overflow-hidden text-ellipsis whitespace-nowrap"
        >
          Acme & co
        </motion.span>
      </motion.div>
      <motion.div
        variants={opacityAnimation}
        layout
        transition={{ duration: 0.3 }}
        animate={mini ? 'exit' : 'initial'}
        className={'flex items-center justify-between px-2 pb-3'}
      >
        <Input
          size="sm"
          variant="bordered"
          placeholder="Type to search..."
          classNames={{
            inputWrapper: ['h-10'],
          }}
          startContent={<MdSearch />}
        />
      </motion.div>
    </>
  )
}
