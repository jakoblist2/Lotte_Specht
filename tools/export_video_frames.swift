import AVFoundation
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: export_video_frames.swift <input.mp4> <output-directory>\n", stderr)
    exit(1)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let framesPerSecond = 12.0

try FileManager.default.createDirectory(
    at: outputURL,
    withIntermediateDirectories: true
)

let asset = AVURLAsset(url: inputURL)
let duration = CMTimeGetSeconds(asset.duration)

guard duration.isFinite, duration > 0 else {
    fputs("Could not read video duration.\n", stderr)
    exit(2)
}

let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 120)
generator.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 120)

let frameCount = Int(ceil(duration * framesPerSecond))

for frameIndex in 0..<frameCount {
    autoreleasepool {
        let time = CMTime(
            seconds: Double(frameIndex) / framesPerSecond,
            preferredTimescale: 600
        )

        do {
            let image = try generator.copyCGImage(at: time, actualTime: nil)
            let filename = String(format: "frame-%04d.jpg", frameIndex + 1)
            let destinationURL = outputURL.appendingPathComponent(filename)

            guard let destination = CGImageDestinationCreateWithURL(
                destinationURL as CFURL,
                UTType.jpeg.identifier as CFString,
                1,
                nil
            ) else {
                throw NSError(domain: "FrameExport", code: 3)
            }

            let options = [
                kCGImageDestinationLossyCompressionQuality: 0.82
            ] as CFDictionary

            CGImageDestinationAddImage(destination, image, options)

            guard CGImageDestinationFinalize(destination) else {
                throw NSError(domain: "FrameExport", code: 4)
            }
        } catch {
            fputs("Frame \(frameIndex + 1) failed: \(error)\n", stderr)
            exit(5)
        }
    }

    if (frameIndex + 1) % 24 == 0 || frameIndex + 1 == frameCount {
        print("Exported \(frameIndex + 1) / \(frameCount)")
    }
}

print("duration=\(String(format: "%.3f", duration))")
print("fps=12")
print("frames=\(frameCount)")
