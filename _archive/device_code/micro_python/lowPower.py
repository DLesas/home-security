# Raspberry Pico micropython low-power workaround
# Copyright (C) 2021 Tom Jorquera
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public
# License as published by the Free Software Foundation; either
# version 3 of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.
#
#  You should have received a copy of the GNU General Public License
#  along with this program.  If not, see <https://www.gnu.org/licenses/>.


# This code is based on the work of Tom Jorquera.
# https://github.com/tomjorquera/pico-micropython-lowpower-workaround

REG_IO_BANK0_BASE = 0x40014000
REG_IO_BANK0_INTR0 = 0x0F0
REG_IO_BANK0_DORMANT_WAKE_INTE0 = 0x160

IO_BANK0_DORMANT_WAKE_INTE0_GPIO0_EDGE_HIGH_BITS = 0x00000008
IO_BANK0_DORMANT_WAKE_INTE0_GPIO0_EDGE_LOW_BITS = 0x00000004
IO_BANK0_DORMANT_WAKE_INTE0_GPIO0_LEVEL_HIGH_BITS = 0x00000002
IO_BANK0_DORMANT_WAKE_INTE0_GPIO0_LEVEL_LOW_BITS = 0x00000001

REG_XOSC_BASE = 0x40024000
REG_XOSC_DORMANT = 0x08
REG_XOSC_STATUS = 0x04

XOSC_DORMANT_VALUE_DORMANT = 0x636F6D61
XOSC_STATUS_STABLE_BITS = 0x80000000

# Helper values to set individual pin modes
EDGE_HIGH = IO_BANK0_DORMANT_WAKE_INTE0_GPIO0_EDGE_HIGH_BITS
EDGE_LOW = IO_BANK0_DORMANT_WAKE_INTE0_GPIO0_EDGE_LOW_BITS
LEVEL_HIGH = IO_BANK0_DORMANT_WAKE_INTE0_GPIO0_LEVEL_HIGH_BITS
LEVEL_LOW = IO_BANK0_DORMANT_WAKE_INTE0_GPIO0_LEVEL_LOW_BITS

ROSC_BASE = 0x40060000

# Clock
CLOCKS_BASE = 0x40008000
CLK_REF_CTRL = 0x30
CLK_SYS_CTRL = 0x3C
CLK_PERI_CTRL = 0x48
CLK_USB_CTRL = 0x54
CLK_ADC_CTRL = 0x60
CLK_RTC_CTRL = 0x6C
PLL_SYS_BASE = 0x40028000
PLL_USB_BASE = 0x4002C000
PLL_PWR = 0x4

import machine

@micropython.asm_thumb
def _read_bits(r0):
    """
    Assembly function to read bits from a register.
    
    Args:
        r0 (int): Register address to read from.
    """
    ldr(r0, [r0, 0])


@micropython.asm_thumb
def _write_bits(r0, r1):
    """
    Assembly function to write bits to a register.
    
    Args:
        r0 (int): Register address to write to.
        r1 (int): Value to write to the register.
    """
    str(r1, [r0, 0])
    
def dormant_with_modes(pin_modes: dict):
    registers_events = {}
    for gpio_pin, pin_mode in pin_modes.items():
        if not isinstance(gpio_pin, int) or gpio_pin < 0 or gpio_pin > 28:
            raise RuntimeError(
                "Invalid value for pin "
                + str(gpio_pin)
                + " (expect int between 0 and 27)"
            )

        if not isinstance(pin_mode, int) or pin_mode < 1 or pin_mode > 15:
            raise RuntimeError(
                "Invalid value for pin_mode "
                + str(pin_mode)
                + " (expect int between 0 and 15)"
            )

        # clear irq
        _write_bits(
            REG_IO_BANK0_BASE + REG_IO_BANK0_INTR0 + int(gpio_pin / 8) * 4,
            pin_mode << 4 * (gpio_pin % 8),
        )
        en_reg = (
            REG_IO_BANK0_BASE + REG_IO_BANK0_DORMANT_WAKE_INTE0 + int(gpio_pin / 8) * 4
        )

        if en_reg not in registers_events:
            registers_events[en_reg] = 0
        registers_events[en_reg] = registers_events[en_reg] | (
            pin_mode << 4 * (gpio_pin % 8)
        )

    # Enable Wake-up from GPIO IRQ
    for en_reg, events in registers_events.items():
        _write_bits(en_reg, events)

    # Setup clocks for going dormant
    _write_bits(CLOCKS_BASE + CLK_REF_CTRL, 0x02)
    _write_bits(CLOCKS_BASE + CLK_SYS_CTRL, 0x00)
    _write_bits(CLOCKS_BASE + CLK_USB_CTRL, 0x00)
    _write_bits(CLOCKS_BASE + CLK_ADC_CTRL, 0x00)
    _write_bits(CLOCKS_BASE + CLK_RTC_CTRL, 0x60)
    _write_bits(CLOCKS_BASE + CLK_PERI_CTRL, 0x00)
    _write_bits(PLL_USB_BASE + PLL_PWR, 0x2D)
    _write_bits(ROSC_BASE, 0xD1EAA0)

    # Go dormant
    _write_bits(REG_XOSC_BASE + REG_XOSC_DORMANT, XOSC_DORMANT_VALUE_DORMANT)

    ###
    # This part will happen after the pico wakes up
    ###

    # Normalize clocks
    _write_bits(CLOCKS_BASE + CLK_REF_CTRL, 0x02)
    _write_bits(CLOCKS_BASE + CLK_SYS_CTRL, 0x01)
    _write_bits(CLOCKS_BASE + CLK_USB_CTRL, 0x800)
    _write_bits(CLOCKS_BASE + CLK_ADC_CTRL, 0x800)
    _write_bits(CLOCKS_BASE + CLK_RTC_CTRL, 0x800)
    _write_bits(CLOCKS_BASE + CLK_PERI_CTRL, 0x800)
    _write_bits(PLL_USB_BASE + PLL_PWR, 0x04)
    _write_bits(ROSC_BASE, 0xFFFAA0)

    while not _read_bits(REG_XOSC_BASE + REG_XOSC_STATUS) & XOSC_STATUS_STABLE_BITS:
        pass

    for gpio_pin, pin_mode in pin_modes.items():
        # clear irq
        _write_bits(
            REG_IO_BANK0_BASE + REG_IO_BANK0_INTR0 + int(gpio_pin / 8) * 4,
            pin_mode << 4 * (gpio_pin % 8),
        )


def dormant_with_modes_and_timeout(pin_modes: dict, timeout_ms: int = None):
    """
    Put the Raspberry Pi Pico into dormant mode with specified pin modes for wake-up.
    
    Args:
        pin_modes (dict): Dictionary mapping GPIO pins to their wake-up modes.
                          Valid pin numbers are 0-27 and valid modes are 1-15.
        timeout_ms (int, optional): Timeout in milliseconds. If specified, the Pico
                                    will wake up after this time if no pin event occurs.
    
    Raises:
        RuntimeError: If an invalid pin number or mode is provided.
    """
    registers_events = {}
    for gpio_pin, pin_mode in pin_modes.items():
        if not isinstance(gpio_pin, int) or gpio_pin < 0 or gpio_pin > 28:
            raise RuntimeError(
                "Invalid value for pin "
                + str(gpio_pin)
                + " (expect int between 0 and 27)"
            )

        if not isinstance(pin_mode, int) or pin_mode < 1 or pin_mode > 15:
            raise RuntimeError(
                "Invalid value for pin_mode "
                + str(pin_mode)
                + " (expect int between 0 and 15)"
            )

        # Clear IRQ for the specified GPIO pin
        _write_bits(
            REG_IO_BANK0_BASE + REG_IO_BANK0_INTR0 + int(gpio_pin / 8) * 4,
            pin_mode << 4 * (gpio_pin % 8),
        )
        en_reg = (
            REG_IO_BANK0_BASE + REG_IO_BANK0_DORMANT_WAKE_INTE0 + int(gpio_pin / 8) * 4
        )

        if en_reg not in registers_events:
            registers_events[en_reg] = 0
        registers_events[en_reg] = registers_events[en_reg] | (
            pin_mode << 4 * (gpio_pin % 8)
        )

    # Enable Wake-up from GPIO IRQ
    for en_reg, events in registers_events.items():
        _write_bits(en_reg, events)

    # Setup Timer for timeout if specified
    timer = None
    if timeout_ms is not None:
        timer = machine.Timer()
        timer.init(mode=machine.Timer.ONE_SHOT, period=timeout_ms, callback=lambda t: None)

    # Save current clock states
    clk_ref_ctrl = _read_bits(CLOCKS_BASE + CLK_REF_CTRL)
    clk_sys_ctrl = _read_bits(CLOCKS_BASE + CLK_SYS_CTRL)
    clk_peri_ctrl = _read_bits(CLOCKS_BASE + CLK_PERI_CTRL)
    clk_usb_ctrl = _read_bits(CLOCKS_BASE + CLK_USB_CTRL)
    clk_adc_ctrl = _read_bits(CLOCKS_BASE + CLK_ADC_CTRL)
    pll_usb_pwr = _read_bits(PLL_USB_BASE + PLL_PWR)
    rosc_ctrl = _read_bits(ROSC_BASE)

    # Setup clocks for going dormant
    _write_bits(CLOCKS_BASE + CLK_REF_CTRL, 0x02)  # Set reference clock to XOSC
    _write_bits(CLOCKS_BASE + CLK_SYS_CTRL, 0x00)  # Disable system clock
    _write_bits(CLOCKS_BASE + CLK_PERI_CTRL, 0x00) # Disable peripheral clock
    _write_bits(CLOCKS_BASE + CLK_USB_CTRL, 0x00)  # Disable USB clock
    _write_bits(CLOCKS_BASE + CLK_ADC_CTRL, 0x00)  # Disable ADC clock
    _write_bits(PLL_USB_BASE + PLL_PWR, 0x2D)      # Power down USB PLL
    _write_bits(ROSC_BASE, 0xD1EAA0)               # Set ROSC to dormant mode

    # Go dormant
    _write_bits(REG_XOSC_BASE + REG_XOSC_DORMANT, XOSC_DORMANT_VALUE_DORMANT)

    ###
    # This part will happen after the pico wakes up
    ###

    # Wait for XOSC to stabilize
    while not _read_bits(REG_XOSC_BASE + REG_XOSC_STATUS) & XOSC_STATUS_STABLE_BITS:
        pass

    # Restore clock states
    _write_bits(CLOCKS_BASE + CLK_REF_CTRL, clk_ref_ctrl)
    _write_bits(CLOCKS_BASE + CLK_SYS_CTRL, clk_sys_ctrl)
    _write_bits(CLOCKS_BASE + CLK_PERI_CTRL, clk_peri_ctrl)
    _write_bits(CLOCKS_BASE + CLK_USB_CTRL, clk_usb_ctrl)
    _write_bits(CLOCKS_BASE + CLK_ADC_CTRL, clk_adc_ctrl)
    _write_bits(PLL_USB_BASE + PLL_PWR, pll_usb_pwr)
    _write_bits(ROSC_BASE, rosc_ctrl)

    # Disable Timer
    if timer:
        timer.deinit()

    for gpio_pin, pin_mode in pin_modes.items():
        # Clear IRQ for the specified GPIO pin
        _write_bits(
            REG_IO_BANK0_BASE + REG_IO_BANK0_INTR0 + int(gpio_pin / 8) * 4,
            pin_mode << 4 * (gpio_pin % 8),
        )

    # Return True if woken up by timeout, False otherwise
    return timer.value() == 0 if timer else False


def dormant_until_pins_or_timeout(gpio_pins: list, edge: bool = True, high: bool = True, timeout_ms: int = None):
    """
    Put the Raspberry Pi Pico into dormant mode until any of the specified GPIO pins
    trigger a wake-up event or the timeout is reached.
    
    Args:
        gpio_pins (list): List of GPIO pins to monitor for wake-up events.
        edge (bool): If True, wake-up on edge events. If False, wake-up on level events.
        high (bool): If True, wake-up on high events. If False, wake-up on low events.
        timeout_ms (int, optional): Timeout in milliseconds. If specified, the Pico
                                    will wake up after this time if no pin event occurs.
    
    The `edge` argument determines whether the wake-up event is based on an edge or level:
        - Edge Event: A transition on the GPIO pin (low to high or high to low).
        - Level Event: The GPIO pin being at a specific level (high or low).
    
    Example Usage:
        - Wake up on a rising edge or after 5 seconds:
            dormant_until_pins([5], edge=True, high=True, timeout_ms=5000)
        - Wake up on a falling edge or after 10 seconds:
            dormant_until_pins([5], edge=True, high=False, timeout_ms=10000)
    """
    low = not high
    level = not edge

    if level and low:
        event = LEVEL_LOW
    if level and high:
        event = LEVEL_HIGH
    if edge and low:
        event = EDGE_LOW
    if edge and high:
        event = EDGE_HIGH

    if timeout_ms is None:
        dormant_with_modes({pin: event for pin in gpio_pins})
    else:
        dormant_with_modes_and_timeout({pin: event for pin in gpio_pins}, timeout_ms)


def dormant_until_pin_or_timeout(gpio_pin: int, edge: bool = True, high: bool = True, timeout_ms: int = None):
    """
    Put the Raspberry Pi Pico into dormant mode until the specified GPIO pin
    triggers a wake-up event or the timeout is reached.
    
    Args:
        gpio_pin (int): GPIO pin to monitor for a wake-up event.
        edge (bool): If True, wake-up on edge events. If False, wake-up on level events.
        high (bool): If True, wake-up on high events. If False, wake-up on low events.
        timeout_ms (int, optional): Timeout in milliseconds. If specified, the Pico
                                    will wake up after this time if no pin event occurs.
    
    The `edge` argument determines whether the wake-up event is based on an edge or level:
        - Edge Event: A transition on the GPIO pin (low to high or high to low).
        - Level Event: The GPIO pin being at a specific level (high or low).
    
    Example Usage:
        - Wake up on a rising edge or after 5 seconds:
            dormant_until_pin(5, edge=True, high=True, timeout_ms=5000)
        - Wake up on a falling edge or after 10 seconds:
            dormant_until_pin(5, edge=True, high=False, timeout_ms=10000)
    """
    if timeout_ms is None:
        dormant_until_pins_or_timeout([gpio_pin], edge, high)
    else:
        dormant_until_pins_or_timeout([gpio_pin], edge, high, timeout_ms)


@micropython.asm_thumb
def lightsleep():
    """
    Put the Raspberry Pi Pico into light sleep mode.
    """
    wfi()
