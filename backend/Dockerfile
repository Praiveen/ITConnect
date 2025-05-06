#
# Build stage
#
FROM gradle:latest AS build
COPY --chown=gradle:gradle . /home/gradle/src
WORKDIR /home/gradle/src
RUN gradle build

#
# Package stage
#
FROM openjdk:21
WORKDIR /app
COPY --from=build /home/gradle/src/build/libs/*.jar /app/demo.jar
EXPOSE 8080

ENV DATABASE_URL=''
ENV DATABASE_USERNAME=''
ENV DATABASE_PASSWORD=''
ENV JWT_SECRET_KEY=''

ENTRYPOINT ["java", "-jar", "demo.jar"]