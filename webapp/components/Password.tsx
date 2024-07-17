'use client';

import React from 'react';
import { Input } from '@nextui-org/input';
import { AiFillEye, AiFillEyeInvisible } from 'react-icons/ai';



export default function Password(props: any) {
	const [isVisible, setIsVisible] = React.useState(false);
	const toggleVisibility = () => setIsVisible(!isVisible);

	return (
		<Input
			label="Password"
			variant="bordered"
			placeholder="Enter your password"
			endContent={
				<button className="focus:outline-none" type="button" onClick={toggleVisibility}>
					{isVisible ? (
						<AiFillEyeInvisible
							title="Show password"
							className="text-2xl pointer-events-none"
						/>
					) : (
						<AiFillEye title="Hide password" className="text-2xl pointer-events-none" />
					)}
				</button>
			}
			type={isVisible ? 'text' : 'password'}
			{...props}
		/>
	);
}
