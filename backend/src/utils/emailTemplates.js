const generateDeadlineEmail = (event, stage, user) => {
  const stageDetails = {
    '48h': {
      subject: `⏰ Reminder: ${event.title} closes in 48 hours`,
      heading: 'Registration closes in 48 hours!',
      description: `Don't miss out on ${event.title}. Registration is closing soon.`
    },
    '24h': {
      subject: `⚠ Registration closes tomorrow: ${event.title}`,
      heading: 'Registration closes tomorrow!',
      description: `Time is running out to register for ${event.title}.`
    },
    '3h': {
      subject: `🚨 Last chance to register for ${event.title}`,
      heading: 'Last chance to register!',
      description: `Registration for ${event.title} closes in just 3 hours.`
    }
  };

  const details = stageDetails[stage];
  const eventLink = process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/events/${event._id}` : `http://localhost:5173/events/${event._id}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #2563eb; text-align: center;">EventSync</h2>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-top: 20px;">
        <h3 style="color: #1f2937; margin-top: 0;">${details.heading}</h3>
        <p style="font-size: 16px;">Hi ${user.name},</p>
        <p style="font-size: 16px;">${details.description}</p>
        
        <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #111827;">${event.title}</h4>
          <p style="margin: 5px 0; font-size: 14px;"><strong>Organizer:</strong> ${event.organizer}</p>
          <p style="margin: 5px 0; font-size: 14px;"><strong>Deadline:</strong> ${new Date(event.registrationDeadline).toLocaleString()}</p>
          ${event.venue ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Venue:</strong> ${event.venue} (${event.mode})</p>` : ''}
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
    html
  };
};

module.exports = {
  generateDeadlineEmail
};
