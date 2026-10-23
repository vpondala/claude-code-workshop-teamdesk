CREATE TABLE `booking_attendees` (
	`booking_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	PRIMARY KEY(`booking_id`, `member_id`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
