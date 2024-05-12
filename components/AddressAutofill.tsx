'use client'

import { AddressAutofillCore } from '@mapbox/search-js-core'
import { Input } from '@nextui-org/input'
import React, { useEffect, useRef, useState } from 'react'
import { MdLocationOn } from 'react-icons/md'
import { cn } from '@/lib/utils'
import { Listbox, ListboxItem, ListboxSection } from '@nextui-org/listbox'
import { AddressAutofillSuggestion } from '@mapbox/search-js-core'
import { Tooltip } from '@nextui-org/tooltip'

interface AddressAutofillComponentProps {
  setValue: React.Dispatch<React.SetStateAction<addressValsType>>
  className?: React.ComponentProps<'div'>['className']
  manualFunc?: React.Dispatch<React.SetStateAction<boolean>>
  label: string
  placeholder: string
  sessionToken: string
}

export type addressValsType = {
  address_line1: string | undefined
  address_line2: string | undefined
  city: string | undefined
  country: string | undefined
  postcode: string | undefined
}

export function AddressAutofillComponent({
  setValue,
  className,
  manualFunc,
  label,
  placeholder,
  sessionToken,
}: AddressAutofillComponentProps) {
  const [internalValue, setInternalValue] = useState('')
  const [suggestions, setSuggestions] = useState<AddressAutofillSuggestion[]>(
    []
  )
  const [suggestionOpen, setSuggestionOpen] = useState(false)
  const input = useRef<HTMLDivElement>(null)

  const autofill = new AddressAutofillCore({
    accessToken: process.env.NEXT_PUBLIC_MAPBOX_API_TOKEN,
  })

  function setAddress(selectedSuggestions: AddressAutofillSuggestion) {
    const address = selectedSuggestions
    setValue({
      address_line1: address?.address_line1,
      address_line2: address?.address_line2
        ? address?.address_line2
        : address?.address_level3,
      city: address?.address_level2,
      country: address?.country,
      postcode: address?.postcode,
    })
    manualFunc!(true)
  }

  const getSuggestions = async (addr: string) => {
    const response = await autofill.suggest(addr, {
      sessionToken: sessionToken,
    })
    console.log(response)
    setSuggestions(response.suggestions)
    setSuggestionOpen(true)
    return
  }

  useEffect(() => {
    if (internalValue.replaceAll(' ', '').length > 3) {
      getSuggestions(internalValue)
    }
  }, [internalValue])

  return (
    <div
      ref={input}
      className={cn('flex w-full flex-col justify-start gap-0', className)}
    >
      <Input
        value={internalValue}
        onValueChange={(v: string) => setInternalValue(v)}
        color="primary"
        className="w-full rounded-lg"
        type="text"
        variant="bordered"
        label={label}
        placeholder={placeholder}
        autoComplete="address"
        isRequired
        required
        startContent={
          <MdLocationOn className="xl:text-lg fhd:text-xl qhd:text-2xl"></MdLocationOn>
        }
      ></Input>
      <Tooltip
        placement="bottom"
        isOpen={suggestionOpen}
        content={
          <Listbox
            style={{
              width: `${input.current ? input.current.offsetWidth : 'None'}px`,
            }}
            variant="solid"
            color="primary"
            aria-label="Location autocomplete"
          >
            <ListboxSection showDivider>
              {suggestions.length > 0 ? (
                suggestions.map((suggestion) => {
                  return (
                    <ListboxItem
                      classNames={{ base: 'text-ellipsis' }}
                      onClick={(e) => {
                        setAddress(suggestion)
                        setSuggestionOpen(false)
                      }}
                      key={suggestion.full_address!}
                    >
                      {suggestion.full_address}
                    </ListboxItem>
                  )
                })
              ) : (
                <ListboxItem key={'address not found'}> No results</ListboxItem>
              )}
            </ListboxSection>
            <ListboxItem
              color="warning"
              onClick={(e) => {
                setSuggestionOpen(false)
                manualFunc!(true)
              }}
              className="py-2 text-warning"
              key={'set address manually'}
            >
              {' '}
              Enter Address manually{' '}
            </ListboxItem>
          </Listbox>
        }
      >
        <div></div>
      </Tooltip>
    </div>
  )
}
