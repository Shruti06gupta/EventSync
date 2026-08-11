const generateDeadlineEmail = (event, stage, user) => {
  const safeTitle = event?.title || 'Event';
  const safeOrganizer = event?.organizer || 'Organizer not listed';
  const safeName = user?.name || 'there';
  const deadlineText = event?.registrationDeadline
    ? new Date(event.registrationDeadline).toLocaleString()
    : 'Not available';

  const stageDetails = {
    weekly: {
      subject: `Reminder: ${safeTitle} registration closes in 1 week`,
      heading: 'Registration closes in 1 week',
      description: `Don't miss out on ${safeTitle}. Registration closes in about one week.`,
    },
    '24h': {
      subject: `Reminder: ${safeTitle} registration closes in 24 hours`,
      heading: 'Registration closes in 24 hours',
      description: `Time is running out to register for ${safeTitle}.`,
    },
    '6h': {
      subject: `Reminder: ${safeTitle} registration closes in 6 hours`,
      heading: 'Registration closes in 6 hours',
      description: `Registration for ${safeTitle} closes in about 6 hours.`,
    },
  };

  const details = stageDetails[stage];
  if (!details) {
    throw new Error(`Unsupported reminder stage: ${stage}`);
  }
  const eventLink = process.env.CLIENT_URL
    ? `${process.env.CLIENT_URL}/events/${event._id}`
    : `http://localhost:5173/events/${event._id}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #2563eb; text-align: center;">EventSync</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-top: 20px;">
        <h3 style="color: #1f2937; margin-top: 0;">${details.heading}</h3>
        <p style="font-size: 16px;">Hi ${safeName},</p>
        <p style="font-size: 16px;">${details.description}</p>
        
        <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #111827;">${safeTitle}</h4>
          <p style="margin: 5px 0; font-size: 14px;"><strong>Organizer:</strong> ${safeOrganizer}</p>
          <p style="margin: 5px 0; font-size: 14px;"><strong>Deadline:</strong> ${deadlineText}</p>
          ${event?.venue ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Venue:</strong> ${event.venue} (${event.mode || 'TBD'})</p>` : ''}
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${eventLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Event & Register</a>
        </div>
      </div>
      <p style="text-align: center; font-size: 12px; color: #6b7280; margin-top: 20px;">
        You received this email because you opted in to deadline reminders. 
        You can update your preferences in your <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/profile" style="color: #2563eb;">profile settings</a>.
      </p>
    </div>
  `;

  return {
    subject: details.subject,
    html,
  };
};

module.exports = {
  generateDeadlineEmail,
};
