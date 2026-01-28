export const errorHandler = (err, req, res, next) => {
    console.error("Global error:", err);

    res.status(err.statusCode || 500).json({
        success: err.success ?? false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
    });
};
