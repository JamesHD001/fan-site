const Event = require("../models/Event");
const Celebrity = require("../models/Celebrity");

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
};

/*
 * Public: list visible events.
 */
const getEvents = async (req, res) => {
  try {
    const query = {};

    // Public sees only non-draft, non-cancelled events
    if (!req.user || req.user.role !== "ADMIN") {
      query.status = { $in: ["UPCOMING", "ONGOING", "COMPLETED"] };
    } else if (req.query.status) {
      query.status = req.query.status;
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      50,
      parseInt(req.query.limit) || 20
    );
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate("celebrityId", "name slug profileImage")
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get events error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve events.",
    });
  }
};

/*
 * Public: get a single event by id.
 */
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(
      req.params.id
    ).populate("celebrityId", "name slug profileImage");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    const isAdmin =
      req.user && req.user.role === "ADMIN";

    if (
      !isAdmin &&
      ["DRAFT", "CANCELLED"].includes(event.status)
    ) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: { event },
    });
  } catch (error) {
    console.error("Get event error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve event.",
    });
  }
};

/*
 * Admin: create an event.
 */
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      image,
      celebrityId,
      startDate,
      endDate,
      capacity,
      price,
      currency,
      minimumMembershipTier,
      status,
    } = req.body;

    if (!title || !description || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message:
          "Title, description, start date and end date are required.",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date values provided.",
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message:
          "End date must be after the start date.",
      });
    }

    // Validate celebrity reference when provided
    if (celebrityId) {
      const celebrityExists =
        await Celebrity.exists({
          _id: celebrityId,
        });

      if (!celebrityExists) {
        return res.status(404).json({
          success: false,
          message: "Celebrity not found.",
        });
      }
    } else {
      // Default to the platform's celebrity
      const defaultCelebrity =
        await Celebrity.findOne();

      if (defaultCelebrity) {
        celebrityId = defaultCelebrity._id.toString();
      }
    }

    let slug = slugify(title);

    const slugTaken = await Event.exists({ slug });

    if (slugTaken) {
      slug = `${slug}-${Date.now()
        .toString(36)
        .toLowerCase()}`;
    }

    const event = await Event.create({
      celebrityId,
      title,
      slug,
      description,
      image: image || "",
      startDate: start,
      endDate: end,
      capacity:
        Number.isInteger(capacity) && capacity > 0
          ? capacity
          : 1,
      price:
        typeof price === "number" &&
          Number.isFinite(price) &&
          price >= 0
          ? price
          : 0,
      currency: currency || "USD",
      minimumMembershipTier:
        minimumMembershipTier || "FAN",
      status: status || "DRAFT",
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully.",
      data: { event },
    });
  } catch (error) {
    console.error("Create event error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to create event.",
    });
  }
};

/*
 * Admin: update an event.
 */
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(
      req.params.id
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "image",
      "startDate",
      "endDate",
      "capacity",
      "price",
      "currency",
      "minimumMembershipTier",
      "status",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    }

    // Validate dates if either was changed
    if (
      req.body.startDate !== undefined ||
      req.body.endDate !== undefined
    ) {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        return res.status(400).json({
          success: false,
          message:
            "End date must be after the start date.",
        });
      }
    }

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event updated successfully.",
      data: { event },
    });
  } catch (error) {
    console.error("Update event error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to update event.",
    });
  }
};

/*
 * Admin: delete an event.
 */
const deleteEvent = async (req, res) => {
  try {
    const result = await Event.deleteOne({
      _id: req.params.id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully.",
    });
  } catch (error) {
    console.error("Delete event error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete event.",
    });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
};
